-- ============================================================
-- Phase 5: XP, Levels, Weekly Challenges
-- ============================================================

-- 1. XP + level on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS xp_total  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xp_level  INT DEFAULT 1;

-- 2. updated_at on user_program_progress (for "most recently worked" sort)
ALTER TABLE user_program_progress
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Weekly challenges (one per week, same for all users)
CREATE TABLE IF NOT EXISTS weekly_challenges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT NOT NULL,
  target_reps INT  NOT NULL,
  week_start  DATE NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE weekly_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_challenges_read" ON weekly_challenges;
CREATE POLICY "weekly_challenges_read" ON weekly_challenges FOR SELECT USING (true);

DROP POLICY IF EXISTS "weekly_challenges_insert" ON weekly_challenges;
CREATE POLICY "weekly_challenges_insert" ON weekly_challenges FOR INSERT
  TO authenticated WITH CHECK (true);

-- 4. User progress on the weekly challenge
CREATE TABLE IF NOT EXISTS user_challenge_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES weekly_challenges(id) ON DELETE CASCADE,
  current_reps INT  DEFAULT 0,
  completed    BOOLEAN DEFAULT false,
  xp_awarded   INT  DEFAULT 0,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, challenge_id)
);

ALTER TABLE user_challenge_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_challenge_progress_owner" ON user_challenge_progress;
CREATE POLICY "user_challenge_progress_owner"
  ON user_challenge_progress FOR ALL
  USING (user_id = auth.uid());

-- 5. RPC: atomically award XP and recalculate level
-- Level formula: level = floor(sqrt(xp_total / 100)) + 1, capped at 50
CREATE OR REPLACE FUNCTION award_xp(p_user_id UUID, p_xp INT)
RETURNS TABLE(new_total INT, new_level INT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_total INT;
  v_new_level INT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE profiles
  SET
    xp_total = GREATEST(0, COALESCE(xp_total, 0) + p_xp),
    xp_level = LEAST(50, GREATEST(1,
      FLOOR(SQRT(GREATEST(0, COALESCE(xp_total, 0) + p_xp) / 100.0))::INT + 1
    ))
  WHERE id = p_user_id
  RETURNING xp_total, xp_level INTO v_new_total, v_new_level;

  RETURN QUERY SELECT v_new_total, v_new_level;
END;
$$;

-- 6. RPC: get or create the current week's challenge (race-safe)
CREATE OR REPLACE FUNCTION get_or_create_weekly_challenge()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_week_start DATE;
  v_exercises  TEXT[] := ARRAY['push_up','sit_up','pull_up','squat','bicep_curl','lateral_raise','overhead_press'];
  v_targets    INT[]  := ARRAY[100,       150,     50,       120,    80,          60,              60           ];
  v_idx        INT;
  v_row        weekly_challenges;
BEGIN
  v_week_start := date_trunc('week', CURRENT_DATE AT TIME ZONE 'UTC')::DATE;

  SELECT * INTO v_row FROM weekly_challenges WHERE week_start = v_week_start;

  IF NOT FOUND THEN
    v_idx := (EXTRACT(EPOCH FROM v_week_start)::BIGINT / 604800 % array_length(v_exercises, 1))::INT + 1;

    BEGIN
      INSERT INTO weekly_challenges(exercise_id, target_reps, week_start)
      VALUES (v_exercises[v_idx], v_targets[v_idx], v_week_start)
      RETURNING * INTO v_row;
    EXCEPTION WHEN unique_violation THEN
      SELECT * INTO v_row FROM weekly_challenges WHERE week_start = v_week_start;
    END;
  END IF;

  RETURN row_to_json(v_row);
END;
$$;

CREATE INDEX IF NOT EXISTS idx_user_challenge_progress_user
  ON user_challenge_progress(user_id, challenge_id);
