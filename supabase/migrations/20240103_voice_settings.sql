ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS voice_settings JSONB DEFAULT '{"enabled":true,"rate":1.0,"pitch":1.0}';
