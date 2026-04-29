-- Force global Seedream model to 4.5
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS seedream_model_alias TEXT NOT NULL DEFAULT 'seedream-4.5';

UPDATE user_profiles
SET seedream_model_alias = 'seedream-4.5'
WHERE seedream_model_alias IS DISTINCT FROM 'seedream-4.5';

ALTER TABLE user_profiles
  ALTER COLUMN seedream_model_alias SET DEFAULT 'seedream-4.5';

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_seedream_model_alias_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_seedream_model_alias_check
  CHECK (seedream_model_alias = 'seedream-4.5');

REVOKE UPDATE (seedream_model_alias)
  ON user_profiles
  FROM authenticated;
