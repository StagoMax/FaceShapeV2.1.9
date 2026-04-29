import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';
import {
  formatPaypalCheckoutAmount,
  normalizePaypalCheckoutCurrency,
} from '../_shared/paypalPricing.ts';

type CapturePayload = {
  orderId?: string;
  packageId?: string;
  currency?: string;
};

type CreditPackageRow = {
  id: string;
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

const paypalBase = paypalEnv === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

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

const fetchCurrentCredits = async (supabaseAdmin: ReturnType<typeof createClient>, userId: string) => {
  const { data, error } = await supabaseAdmin.rpc('get_user_credit_balance', {
    user_uuid: userId,
  });
  if (error) {
    throw error;
  }
  return typeof data === 'number' ? data : 0;
};

const extractCapture = (orderPayload: Record<string, unknown>) => {
  const purchaseUnits = orderPayload.purchase_units as Array<Record<string, unknown>> | undefined;
  const firstUnit = purchaseUnits?.[0] ?? null;
  const payments = firstUnit?.payments as Record<string, unknown> | undefined;
  const captures = payments?.captures as Array<Record<string, unknown>> | undefined;
  const capture = captures?.[0] ?? null;
  if (!capture) {
    return null;
  }
  const amount = capture.amount as Record<string, unknown> | undefined;
  return {
    captureId: String(capture.id ?? ''),
    currency: String(amount?.currency_code ?? 'USD'),
    value: Number(amount?.value ?? 0),
    status: String(capture.status ?? ''),
  };
};

const getOrderDetails = async (paypalToken: string, orderId: string) => {
  const response = await fetch(`${paypalBase}/v2/checkout/orders/${orderId}`, {
    headers: {
      Authorization: `Bearer ${paypalToken}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Failed to fetch PayPal order details');
  }
  return payload as Record<string, unknown>;
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

  let payload: CapturePayload = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!payload.orderId || !payload.packageId) {
    return json({ error: 'missing_order_or_package' }, 400);
  }

  const { data: pkg, error: pkgError } = await supabaseAdmin
    .from('credit_packages')
    .select('id, price_usd, active')
    .eq('id', payload.packageId)
    .single<CreditPackageRow>();

  if (pkgError || !pkg || !pkg.active) {
    return json({ error: 'invalid_credit_package' }, 400);
  }

  const { data: requestRows } = await supabaseAdmin
    .from('credit_purchase_requests')
    .select('id, user_id, package_id, status, paypal_capture_id, currency')
    .eq('provider', 'paypal')
    .eq('paypal_order_id', payload.orderId)
    .order('created_at', { ascending: false })
    .limit(1);

  const requestRow = requestRows?.[0] ?? null;
  if (requestRow && requestRow.user_id !== userData.user.id) {
    return json({ error: 'order_belongs_to_another_user' }, 403);
  }
  if (requestRow && requestRow.package_id !== payload.packageId) {
    return json({ error: 'order_package_mismatch' }, 400);
  }

  if (requestRow?.status === 'completed' && requestRow.paypal_capture_id) {
    const currentCredits = await fetchCurrentCredits(supabaseAdmin, userData.user.id).catch(() => 0);
    return json({
      status: 'completed',
      newCredits: currentCredits,
      requestId: requestRow.id,
      alreadyProcessed: true,
    });
  }

  let paypalToken = '';
  try {
    paypalToken = await getPaypalAccessToken();
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'paypal_auth_failed' }, 502);
  }

  let capturePayload: Record<string, unknown> | null = null;

  const captureResponse = await fetch(`${paypalBase}/v2/checkout/orders/${payload.orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paypalToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `capture-${payload.orderId}`,
    },
    body: JSON.stringify({}),
  });

  const captureJson = await captureResponse.json().catch(() => ({}));

  if (captureResponse.ok) {
    capturePayload = captureJson;
  } else {
    const orderAlreadyCaptured =
      captureJson?.name === 'UNPROCESSABLE_ENTITY' &&
      Array.isArray(captureJson?.details) &&
      captureJson.details.some((item: { issue?: string }) => item.issue === 'ORDER_ALREADY_CAPTURED');

    if (!orderAlreadyCaptured) {
      return json(
        {
          error: 'paypal_capture_failed',
          message: captureJson?.message || 'Failed to capture PayPal order',
          detail: captureJson,
        },
        502
      );
    }

    try {
      capturePayload = await getOrderDetails(paypalToken, payload.orderId);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'failed_to_fetch_order' }, 502);
    }
  }

  if (!capturePayload) {
    return json({ error: 'capture_payload_missing' }, 500);
  }

  const capture = extractCapture(capturePayload);
  if (!capture?.captureId) {
    return json({ error: 'capture_id_missing', detail: capturePayload }, 502);
  }

  const expectedCurrency = normalizePaypalCheckoutCurrency(requestRow?.currency ?? payload.currency);
  if (capture.currency !== expectedCurrency) {
    return json({ error: 'currency_mismatch' }, 400);
  }

  const expectedAmount = formatPaypalCheckoutAmount(Number(pkg.price_usd), expectedCurrency);
  if (Number(capture.value).toFixed(2) !== Number(expectedAmount).toFixed(2)) {
    return json({ error: 'amount_mismatch', expected: expectedAmount, received: capture.value }, 400);
  }

  const payer = capturePayload.payer as Record<string, unknown> | undefined;
  const payerEmail = typeof payer?.email_address === 'string' ? payer.email_address : null;

  let requestId = requestRow?.id ?? null;
  if (!requestId) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('credit_purchase_requests')
      .insert({
        user_id: userData.user.id,
        package_id: payload.packageId,
        provider: 'paypal',
        provider_payment_id: capture.captureId,
        paypal_order_id: payload.orderId,
        status: 'pending',
        currency: capture.currency,
        amount_usd: Number(pkg.price_usd),
        amount_value: capture.value,
        payer_email: payerEmail,
        metadata: { source: 'paypal-capture-order' },
      })
      .select('id')
      .single();

    if (insertError) {
      return json({ error: insertError.message }, 500);
    }
    requestId = inserted.id as string;
  }

  const { data: newCredits, error: grantError } = await supabaseAdmin.rpc('grant_purchase_credits', {
    target_user: userData.user.id,
    package_key: payload.packageId,
    provider_name: 'paypal',
    provider_payment_id: capture.captureId,
  });

  if (grantError) {
    await supabaseAdmin
      .from('credit_purchase_requests')
      .update({
        status: 'failed',
        paypal_capture_id: capture.captureId,
        provider_payment_id: capture.captureId,
        metadata: {
          source: 'paypal-capture-order',
          error: grantError.message,
        },
        processed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    return json({ error: grantError.message }, 500);
  }

  await supabaseAdmin
    .from('credit_purchase_requests')
    .update({
      status: 'completed',
      provider_payment_id: capture.captureId,
      paypal_capture_id: capture.captureId,
      payer_email: payerEmail,
      amount_usd: Number(pkg.price_usd),
      amount_value: capture.value,
      currency: capture.currency,
      metadata: {
        source: 'paypal-capture-order',
        capture_status: capture.status,
      },
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  return json({
    status: 'completed',
    newCredits: typeof newCredits === 'number' ? newCredits : 0,
    requestId,
  });
});
