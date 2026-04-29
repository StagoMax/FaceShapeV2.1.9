import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';
import {
  formatPaypalCheckoutAmount,
  normalizePaypalCheckoutCurrency,
} from '../_shared/paypalPricing.ts';

type CreateOrderPayload = {
  packageId?: string;
  currency?: string;
};

type CreditPackageRow = {
  id: string;
  credits: number;
  price_usd: number;
  active: boolean;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '';
const serviceRoleKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  Deno.env.get('SUPABASE_SECRET_KEY') ||
  Deno.env.get('SERVICE_ROLE_KEY') ||
  '';

const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID') || '';
const paypalClientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET') || '';
const paypalEnv = (Deno.env.get('PAYPAL_ENV') || 'live').toLowerCase();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const paypalBase = paypalEnv === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

const getPaypalAccessToken = async () => {
  const basic = btoa(`${paypalClientId}:${paypalClientSecret}`);
  const response = await fetch(`${paypalBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Failed to get PayPal access token');
  }
  return payload.access_token as string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'supabase_config_missing' }, 500);
  }
  if (!paypalClientId || !paypalClientSecret) {
    return json({ error: 'paypal_config_missing' }, 500);
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }

  const authHeader = req.headers.get('Authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!bearer) {
    return json({ error: 'missing_authorization' }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(bearer);
  if (userError || !userData.user) {
    return json({ error: 'invalid_user_session' }, 401);
  }

  let payload: CreateOrderPayload = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!payload.packageId) {
    return json({ error: 'missing_package_id' }, 400);
  }

  const checkoutCurrency = normalizePaypalCheckoutCurrency(payload.currency);

  const { data: pkg, error: pkgError } = await supabaseAdmin
    .from('credit_packages')
    .select('id, credits, price_usd, active')
    .eq('id', payload.packageId)
    .single<CreditPackageRow>();

  if (pkgError || !pkg || !pkg.active) {
    return json({ error: 'invalid_credit_package' }, 400);
  }

  let paypalToken = '';
  try {
    paypalToken = await getPaypalAccessToken();
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'paypal_auth_failed' }, 502);
  }

  const amountValue = formatPaypalCheckoutAmount(Number(pkg.price_usd), checkoutCurrency);
  const orderResponse = await fetch(`${paypalBase}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${paypalToken}`,
      'PayPal-Request-Id': `miri-${userData.user.id}-${payload.packageId}-${Date.now()}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: payload.packageId,
          custom_id: userData.user.id,
          amount: {
            currency_code: checkoutCurrency,
            value: amountValue,
          },
          description: `Miri credits: ${payload.packageId}`,
        },
      ],
      application_context: {
        user_action: 'PAY_NOW',
      },
    }),
  });

  const orderPayload = await orderResponse.json().catch(() => ({}));
  if (!orderResponse.ok || !orderPayload.id) {
    return json(
      {
        error: 'paypal_create_order_failed',
        message: orderPayload.message || 'Unable to create PayPal order',
        detail: orderPayload,
      },
      502
    );
  }

  const orderId = String(orderPayload.id);
  const approveLink = Array.isArray(orderPayload.links)
    ? (orderPayload.links.find((item: { rel?: string }) => item.rel === 'approve')?.href as string | undefined)
    : undefined;

  const now = new Date().toISOString();

  const { data: existingRows } = await supabaseAdmin
    .from('credit_purchase_requests')
    .select('id')
    .eq('provider', 'paypal')
    .eq('paypal_order_id', orderId)
    .limit(1);

  if (!existingRows?.length) {
    const { error: insertError } = await supabaseAdmin.from('credit_purchase_requests').insert({
      user_id: userData.user.id,
      package_id: payload.packageId,
      provider: 'paypal',
      provider_payment_id: orderId,
      paypal_order_id: orderId,
      amount_usd: Number(pkg.price_usd),
      amount_value: Number(amountValue),
      currency: checkoutCurrency,
      status: 'pending',
      metadata: {
        source: 'paypal-create-order',
        settlementAmount: Number(amountValue),
      },
      processed_at: null,
      updated_at: now,
    });

    if (insertError) {
      return json({ error: insertError.message }, 500);
    }
  }

  return json({ orderId, approveLink, currency: checkoutCurrency, amount: amountValue });
});
