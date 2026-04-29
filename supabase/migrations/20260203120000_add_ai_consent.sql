-- Add AI consent tracking fields to user profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS ai_consent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS privacy_policy_version TEXT,
  ADD COLUMN IF NOT EXISTS terms_of_service_version TEXT;

-- Allow authenticated users to update consent fields on their own profile
GRANT UPDATE (name, avatar_url, ai_consent_at, privacy_policy_version, terms_of_service_version)
  ON user_profiles
  TO authenticated;
