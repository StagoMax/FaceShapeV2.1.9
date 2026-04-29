ALTER TABLE public.credit_purchase_requests
  ADD COLUMN IF NOT EXISTS amount_value NUMERIC(10, 2);

UPDATE public.credit_purchase_requests
SET amount_value = amount_usd
WHERE amount_value IS NULL
  AND amount_usd IS NOT NULL;
