-- Align legacy user_profiles.seedream_model_alias with the global Seedream 5.0 model.
-- The app no longer uses this column to choose a per-user model, but keeping the stored
-- value consistent avoids confusion when inspecting profiles in Supabase.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS seedream_model_alias TEXT NOT NULL DEFAULT 'seedream-5.0-lite';

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_seedream_model_alias_check;

UPDATE user_profiles
SET seedream_model_alias = 'seedream-5.0-lite'
WHERE seedream_model_alias IS DISTINCT FROM 'seedream-5.0-lite';

ALTER TABLE user_profiles
  ALTER COLUMN seedream_model_alias SET DEFAULT 'seedream-5.0-lite';

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_seedream_model_alias_check
  CHECK (seedream_model_alias = 'seedream-5.0-lite');

REVOKE UPDATE (seedream_model_alias)
  ON user_profiles
  FROM authenticated;
