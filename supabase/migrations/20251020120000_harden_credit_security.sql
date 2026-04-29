-- Harden credit and profile security by moving sensitive mutations server-side

-- Restrict public access
REVOKE ALL ON user_profiles FROM anon;
REVOKE ALL ON credit_transactions FROM anon;
REVOKE ALL ON images FROM anon;
REVOKE ALL ON canvas_sessions FROM anon;
REVOKE ALL ON ai_edits FROM anon;

-- Limit authenticated access to profile fields (no direct credit edits)
REVOKE ALL ON user_profiles FROM authenticated;
GRANT SELECT ON user_profiles TO authenticated;
GRANT INSERT (id, name, avatar_url) ON user_profiles TO authenticated;
GRANT UPDATE (name, avatar_url) ON user_profiles TO authenticated;

-- Only allow authenticated users to read their own transactions
REVOKE ALL ON credit_transactions FROM authenticated;
GRANT SELECT ON credit_transactions TO authenticated;

DROP POLICY IF EXISTS "Users can insert their own credit transactions" ON credit_transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON credit_transactions;
DROP POLICY IF EXISTS "Users can view their own credit transactions" ON credit_transactions;
CREATE POLICY "Users can view own credit transactions"
  ON credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Keep new profiles aligned with signup bonus defaults
ALTER TABLE user_profiles
  ALTER COLUMN credits SET DEFAULT 5,
  ALTER COLUMN free_uses_remaining SET DEFAULT 3;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_credits_non_negative'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_credits_non_negative CHECK (credits >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_free_uses_non_negative'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_free_uses_non_negative CHECK (free_uses_remaining >= 0);
  END IF;
END $$;

-- Update new-user trigger to set secure defaults
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, avatar_url, credits, free_uses_remaining)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'avatar_url',
    5,
    3
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Maintain an authoritative list of credit packages
CREATE TABLE IF NOT EXISTS credit_packages (
  id TEXT PRIMARY KEY,
  credits INTEGER NOT NULL CHECK (credits > 0),
  price_usd NUMERIC(10, 2) NOT NULL CHECK (price_usd > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER trigger_update_credit_packages_timestamp
  BEFORE UPDATE ON credit_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view credit packages" ON credit_packages;
CREATE POLICY "Authenticated users can view credit packages"
  ON credit_packages
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

REVOKE ALL ON credit_packages FROM anon;
GRANT SELECT ON credit_packages TO authenticated;

INSERT INTO credit_packages (id, credits, price_usd)
VALUES
  ('credits_10', 10, 0.99),
  ('credits_50', 50, 3.99),
  ('credits_150', 150, 9.99),
  ('credits_400', 400, 19.99)
ON CONFLICT (id) DO UPDATE
SET credits = EXCLUDED.credits,
    price_usd = EXCLUDED.price_usd,
    active = TRUE;

-- Store purchase requests for server-side verification
CREATE TABLE IF NOT EXISTS credit_purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL REFERENCES credit_packages(id),
  provider TEXT NOT NULL,
  provider_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE credit_purchase_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can create purchase requests" ON credit_purchase_requests;
DROP POLICY IF EXISTS "Users can view purchase requests" ON credit_purchase_requests;
CREATE POLICY "Users can create purchase requests"
  ON credit_purchase_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view purchase requests"
  ON credit_purchase_requests
  FOR SELECT
  USING (auth.uid() = user_id);

REVOKE ALL ON credit_purchase_requests FROM anon;
GRANT SELECT, INSERT ON credit_purchase_requests TO authenticated;

-- Harden credit balance RPC to only allow self-access (service_role can query others)
CREATE OR REPLACE FUNCTION public.get_user_credit_balance(user_uuid UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  target_user UUID;
  current_credits INTEGER;
BEGIN
  IF auth.role() = 'service_role' THEN
    target_user := COALESCE(user_uuid, auth.uid());
  ELSE
    target_user := auth.uid();
  END IF;

  IF target_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(credits, 0) INTO current_credits
  FROM user_profiles
  WHERE id = target_user;

  RETURN COALESCE(current_credits, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_user_credit_balance(UUID) TO authenticated;

-- Replace insecure daily credit function with a self-scoped version
DROP FUNCTION IF EXISTS public.add_daily_free_credits(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.claim_daily_free_credits()
RETURNS INTEGER AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
  existing_transaction_count INTEGER;
  current_credits INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COUNT(*) INTO existing_transaction_count
  FROM credit_transactions
  WHERE user_id = auth.uid()
    AND transaction_type = 'purchase'
    AND description LIKE 'Daily free credits - %'
    AND DATE(created_at) = today_date;

  IF existing_transaction_count = 0 THEN
    INSERT INTO credit_transactions (user_id, transaction_type, amount, description)
    VALUES (auth.uid(), 'purchase', 3, 'Daily free credits - ' || today_date);
  END IF;

  SELECT credits INTO current_credits FROM user_profiles WHERE id = auth.uid();
  RETURN COALESCE(current_credits, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.claim_daily_free_credits() TO authenticated;

-- Secure credit consumption
CREATE OR REPLACE FUNCTION public.consume_user_credits(credit_amount INTEGER, description_text TEXT)
RETURNS INTEGER AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF credit_amount IS NULL OR credit_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid credit amount';
  END IF;

  SELECT credits INTO current_credits
  FROM user_profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF current_credits IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  IF current_credits < credit_amount THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  INSERT INTO credit_transactions (user_id, transaction_type, amount, description)
  VALUES (auth.uid(), 'consume', -credit_amount, description_text);

  SELECT credits INTO current_credits FROM user_profiles WHERE id = auth.uid();
  RETURN COALESCE(current_credits, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.consume_user_credits(INTEGER, TEXT) TO authenticated;

-- Grant purchase credits only from server-side (service_role)
CREATE OR REPLACE FUNCTION public.grant_purchase_credits(
  target_user UUID,
  package_key TEXT,
  provider_name TEXT,
  provider_payment_id TEXT
)
RETURNS INTEGER AS $$
DECLARE
  package_credits INTEGER;
  current_credits INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT credits INTO package_credits
  FROM credit_packages
  WHERE id = package_key AND active = TRUE;

  IF package_credits IS NULL THEN
    RAISE EXCEPTION 'Invalid credit package';
  END IF;

  INSERT INTO credit_transactions (user_id, transaction_type, amount, stripe_payment_id, description)
  VALUES (
    target_user,
    'purchase',
    package_credits,
    provider_payment_id,
    'Purchase via ' || provider_name || ' - ' || package_key
  );

  SELECT credits INTO current_credits FROM user_profiles WHERE id = target_user;
  RETURN COALESCE(current_credits, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.grant_purchase_credits(UUID, TEXT, TEXT, TEXT) TO service_role;
