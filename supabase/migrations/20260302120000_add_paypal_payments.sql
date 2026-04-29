-- PayPal payment support for web checkout

ALTER TABLE public.credit_purchase_requests
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT,
  ADD COLUMN IF NOT EXISTS payer_email TEXT,
  ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS trigger_update_credit_purchase_requests_timestamp ON public.credit_purchase_requests;

CREATE TRIGGER trigger_update_credit_purchase_requests_timestamp
  BEFORE UPDATE ON public.credit_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS credit_purchase_requests_paypal_order_uniq
  ON public.credit_purchase_requests (provider, paypal_order_id)
  WHERE provider = 'paypal' AND paypal_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS credit_purchase_requests_paypal_capture_uniq
  ON public.credit_purchase_requests (provider, paypal_capture_id)
  WHERE provider = 'paypal' AND paypal_capture_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.paypal_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  resource_id TEXT,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.paypal_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.paypal_webhook_events FROM anon;
REVOKE ALL ON public.paypal_webhook_events FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.paypal_webhook_events TO service_role;
