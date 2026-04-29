-- Idempotency and safety for purchase credits

-- Ensure purchase tokens are unique per provider
CREATE UNIQUE INDEX IF NOT EXISTS credit_purchase_requests_provider_payment_id_uniq
  ON credit_purchase_requests (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- Ensure each provider payment id is only granted once
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_stripe_payment_id_uniq
  ON credit_transactions (stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

-- Make credit granting idempotent and user-safe
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
  existing_user UUID;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF provider_payment_id IS NOT NULL THEN
    SELECT user_id INTO existing_user
    FROM credit_transactions
    WHERE stripe_payment_id = provider_payment_id
    LIMIT 1;

    IF existing_user IS NOT NULL THEN
      IF existing_user <> target_user THEN
        RAISE EXCEPTION 'Payment already linked to another user';
      END IF;
      SELECT credits INTO current_credits FROM user_profiles WHERE id = target_user;
      RETURN COALESCE(current_credits, 0);
    END IF;
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
