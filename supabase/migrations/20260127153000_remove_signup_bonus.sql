-- Remove signup bonus credits and free uses defaults for new users

ALTER TABLE user_profiles
  ALTER COLUMN credits SET DEFAULT 0,
  ALTER COLUMN free_uses_remaining SET DEFAULT 0;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, avatar_url, credits, free_uses_remaining)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'avatar_url',
    0,
    0
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
