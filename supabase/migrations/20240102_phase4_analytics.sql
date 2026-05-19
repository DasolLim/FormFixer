-- Phase 4: Analytics & Gamification
-- Safe to re-run (all statements are idempotent)

CREATE TABLE IF NOT EXISTS personal_records (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id     TEXT        NOT NULL,
  best_form_score INT         DEFAULT 0,
  best_rep_count  INT         DEFAULT 0,
  best_volume     INT         DEFAULT 0,
  achieved_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, exercise_id)
);

ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personal_records_owner" ON personal_records;
CREATE POLICY "personal_records_owner"
  ON personal_records FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_personal_records_user
  ON personal_records(user_id, exercise_id);

-- ─── Achievements ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS achievements (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT  UNIQUE NOT NULL,
  name        TEXT  NOT NULL,
  description TEXT  NOT NULL,
  icon_name   TEXT  NOT NULL,
  criteria    JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id        UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID  NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_achievements_owner" ON user_achievements;
CREATE POLICY "user_achievements_owner"
  ON user_achievements FOR ALL
  USING (user_id = auth.uid());

-- ─── Seed achievements ────────────────────────────────────────────────────────

INSERT INTO achievements (key, name, description, icon_name, criteria) VALUES
  ('first_session',    'First Rep',         'Complete your first workout session',                       'Dumbbell',      '{"type":"session_count","threshold":1}'),
  ('ten_sessions',     'Dedicated',         'Complete 10 workout sessions',                              'Trophy',        '{"type":"session_count","threshold":10}'),
  ('fifty_sessions',   'Veteran',           'Complete 50 workout sessions',                              'Medal',         '{"type":"session_count","threshold":50}'),
  ('program_complete', 'Program Graduate',  'Complete any full training program',                        'GraduationCap', '{"type":"program_complete"}'),
  ('form_master',      'Form Master',       'Average 90+ form score over 10 sessions on one exercise',  'Star',          '{"type":"avg_form_score","threshold":90,"min_sessions":10}'),
  ('perfect_rep',      'Perfect Rep',       'Score 100 on any single rep',                              'Sparkles',      '{"type":"perfect_rep_score"}'),
  ('iron_symmetry',    'Iron Symmetry',     'Symmetry score 95+ for an entire session',                 'Scale',         '{"type":"session_symmetry","threshold":95}'),
  ('streak_7',         '7-Day Warrior',     'Maintain a 7-day workout streak',                          'Flame',         '{"type":"streak","threshold":7}'),
  ('streak_30',        '30-Day Legend',     'Maintain a 30-day workout streak',                         'Zap',           '{"type":"streak","threshold":30}'),
  ('nutrition_week',   'Fuelled',           'Log meals every day for 7 days',                           'Apple',         '{"type":"nutrition_streak","threshold":7}')
ON CONFLICT (key) DO NOTHING;

-- ─── Body weight logs ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS body_weight_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg   NUMERIC     NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE body_weight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "body_weight_logs_owner" ON body_weight_logs;
CREATE POLICY "body_weight_logs_owner"
  ON body_weight_logs FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_body_weight_logs_user
  ON body_weight_logs(user_id, recorded_at DESC);
