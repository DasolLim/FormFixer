-- ============================================================
-- Phase 6: XP event log + improved award_xp RPC
-- ============================================================

-- 1. Immutable event log (audit trail for all XP changes)
CREATE TABLE IF NOT EXISTS xp_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount     INT         NOT NULL,
  source     TEXT        NOT NULL
    CHECK (source IN (
      'session', 'challenge', 'goal',
      'program', 'weekly_challenge', 'session_milestone'
    )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS xp_events_user_time
  ON xp_events (user_id, created_at DESC);

ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xp_events_owner" ON xp_events;
CREATE POLICY "xp_events_owner"
  ON xp_events FOR SELECT
  USING (user_id = auth.uid());

-- 2. Replace award_xp — returns JSON with level-up detection
DROP FUNCTION IF EXISTS award_xp(UUID, INT);
DROP FUNCTION IF EXISTS award_xp(UUID, INT, TEXT);

CREATE OR REPLACE FUNCTION award_xp(
  p_user_id UUID,
  p_amount  INT,
  p_source  TEXT DEFAULT 'session'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_level INT;
  v_new_total  INT;
  v_new_level  INT;
BEGIN
  -- Capture prev level with row lock (prevents race conditions)
  SELECT xp_level INTO v_prev_level
    FROM profiles
   WHERE id = p_user_id
     FOR UPDATE;

  -- Atomically increment xp_total and recompute xp_level
  UPDATE profiles
     SET xp_total = xp_total + p_amount,
         xp_level = LEAST(50, FLOOR(SQRT((xp_total + p_amount) / 100.0))::INT + 1)
   WHERE id = p_user_id
  RETURNING xp_total, xp_level
       INTO v_new_total, v_new_level;

  -- Append to immutable audit log
  INSERT INTO xp_events (user_id, amount, source)
  VALUES (p_user_id, p_amount, p_source);

  RETURN json_build_object(
    'new_xp',     v_new_total,
    'new_level',  v_new_level,
    'prev_level', v_prev_level,
    'leveled_up', v_new_level > v_prev_level,
    'amount',     p_amount,
    'source',     p_source
  );
END;
$$;

GRANT EXECUTE ON FUNCTION award_xp(UUID, INT, TEXT) TO authenticated;
