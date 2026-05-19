-- ============================================================
-- Phase 1: Foundation migration
-- All changes are additive (nullable columns, new tables)
-- No existing rows are affected
-- ============================================================

-- 1. profiles — add all new columns upfront to avoid repeated migrations
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete       BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS movement_baseline         JSONB       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS equipment_profile         JSONB       DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS current_streak            INT         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak            INT         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_weekly_streak     INT         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_session_date         DATE        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nutrition_goals           JSONB       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_sessions_per_week  INT         DEFAULT 3,
  ADD COLUMN IF NOT EXISTS default_rest_seconds      INT         DEFAULT 60,
  ADD COLUMN IF NOT EXISTS weight_unit               TEXT        DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS target_weight_kg          NUMERIC     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS theme_preference          TEXT        DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS unavailable_days          JSONB       DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS best_form_score           INT         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_digest              BOOLEAN     DEFAULT false;

-- 2. New programs table (replaces static catalog.ts)
CREATE TABLE IF NOT EXISTS programs (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               TEXT        UNIQUE NOT NULL,
  title              TEXT        NOT NULL,
  description        TEXT,
  difficulty         TEXT        NOT NULL CHECK (difficulty IN ('beginner','intermediate','advanced')),
  weeks              INT         NOT NULL CHECK (weeks > 0),
  author_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  is_public          BOOLEAN     DEFAULT true,
  is_ai_generated    BOOLEAN     DEFAULT false,
  required_equipment JSONB       DEFAULT '["bodyweight"]',
  workout_days       JSONB       NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programs_public_read" ON programs;
CREATE POLICY "programs_public_read"
  ON programs FOR SELECT
  USING (is_public = true OR author_id = auth.uid());

DROP POLICY IF EXISTS "programs_author_all" ON programs;
CREATE POLICY "programs_author_all"
  ON programs FOR ALL
  USING (author_id = auth.uid());

-- 3. workout_sessions — add program linkage and set results
ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS program_id   UUID  REFERENCES programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS set_results  JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS load_kg      JSONB DEFAULT NULL;

-- 4. workout_events — add program linkage for deep-links
ALTER TABLE workout_events
  ADD COLUMN IF NOT EXISTS program_day_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS exercise_id    TEXT DEFAULT NULL;

-- 5. notifications — add invite scheduling fields
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS invite_date        TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invite_exercise_id TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invite_status      TEXT        DEFAULT NULL;

-- 6. user_program_progress — add program_id UUID for new programs table linkage
ALTER TABLE user_program_progress
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES programs(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_program_progress_program_id
  ON user_program_progress(user_id, program_id)
  WHERE program_id IS NOT NULL;

-- 7. Streak update trigger
CREATE OR REPLACE FUNCTION update_streak_on_session()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles SET
    current_streak = CASE
      WHEN last_session_date = CURRENT_DATE - INTERVAL '1 day' THEN current_streak + 1
      WHEN last_session_date = CURRENT_DATE                     THEN current_streak
      ELSE 1
    END,
    longest_streak = GREATEST(
      longest_streak,
      CASE
        WHEN last_session_date = CURRENT_DATE - INTERVAL '1 day' THEN current_streak + 1
        ELSE 1
      END
    ),
    last_session_date = CURRENT_DATE
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_session_insert_update_streak ON workout_sessions;
CREATE TRIGGER on_session_insert_update_streak
  AFTER INSERT ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION update_streak_on_session();

-- 8. Best form score trigger
CREATE OR REPLACE FUNCTION update_best_form_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles
  SET best_form_score = GREATEST(best_form_score, NEW.form_score)
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_session_insert_update_best_score ON workout_sessions;
CREATE TRIGGER on_session_insert_update_best_score
  AFTER INSERT ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION update_best_form_score();

-- 9. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_recorded
  ON workout_sessions(user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_program
  ON workout_sessions(program_id) WHERE program_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_events_user_date
  ON workout_events(user_id, scheduled_date DESC);

CREATE INDEX IF NOT EXISTS idx_programs_public
  ON programs(created_at DESC) WHERE is_public = true;
