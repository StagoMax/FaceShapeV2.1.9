-- Add per-user Seedream model selection with strict whitelist
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS seedream_model_alias TEXT NOT NULL DEFAULT 'seedream-4.0';

UPDATE user_profiles
SET seedream_model_alias = 'seedream-4.0'
WHERE seedream_model_alias IS NULL OR btrim(seedream_model_alias) = '';

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_seedream_model_alias_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_seedream_model_alias_check
  CHECK (seedream_model_alias IN ('seedream-4.0', 'seedream-4.5'));

GRANT UPDATE (seedream_model_alias)
  ON user_profiles
  TO authenticated;
