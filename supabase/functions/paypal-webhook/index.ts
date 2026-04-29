import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '';
const serviceRoleKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  Deno.env.get('SUPABASE_SECRET_KEY') ||
  Deno.env.get('SERVICE_ROLE_KEY') ||
  '';

const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID') || '';
const paypalClientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET') || '';
const paypalWebhookId = Deno.env.get('PAYPAL_WEBHOOK_ID') || '';
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

const verifyWebhook = async (
  paypalToken: string,
  headers: Headers,
  eventPayload: Record<string, unknown>
) => {
  const transmissionId = headers.get('paypal-transmission-id');
  const transmissionTime = headers.get('paypal-transmission-time');
  const certUrl = headers.get('paypal-cert-url');
  const authAlgo = headers.get('paypal-auth-algo');
  const transmissionSig = headers.get('paypal-transmission-sig');

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    throw new Error('Missing PayPal transmission headers');
  }

  const response = await fetch(`${paypalBase}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paypalToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: paypalWebhookId,
      webhook_event: eventPayload,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'PayPal webhook verification request failed');
  }

  return payload?.verification_status === 'SUCCESS';
};

const extractCaptureData = (eventPayload: Record<string, unknown>) => {
  const resource = eventPayload.resource as Record<string, unknown> | undefined;
  const captureId = typeof resource?.id === 'string' ? resource.id : null;
  const amount = resource?.amount as Record<string, unknown> | undefined;
  const currency = typeof amount?.currency_code === 'string' ? amount.currency_code : 'USD';
  const value = Number(amount?.value ?? 0);
  const supplementary = resource?.supplementary_data as Record<string, unknown> | undefined;
  const relatedIds = supplementary?.related_ids as Record<string, unknown> | undefined;
  const orderId = typeof relatedIds?.order_id === 'string' ? relatedIds.order_id : null;
  const payer = resource?.payer as Record<string, unknown> | undefined;
  const payerEmail = typeof payer?.email_address === 'string' ? payer.email_address : null;

  return {
    captureId,
    orderId,
    currency,
    value,
    payerEmail,
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'supabase_config_missing' }, 500);
  }
  if (!paypalClientId || !paypalClientSecret || !paypalWebhookId) {
    return json({ error: 'paypal_config_missing' }, 500);
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }

  const rawBody = await req.text();
  let eventPayload: Record<string, unknown>;
  try {
    eventPayload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  let paypalToken = '';
  try {
    paypalToken = await getPaypalAccessToken();
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'paypal_auth_failed' }, 502);
  }

  let verified = false;
  try {
    verified = await verifyWebhook(paypalToken, req.headers, eventPayload);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'verification_failed' }, 400);
  }

  if (!verified) {
    return json({ error: 'invalid_webhook_signature' }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const eventId = typeof eventPayload.id === 'string' ? eventPayload.id : null;
  const eventType = typeof eventPayload.event_type === 'string' ? eventPayload.event_type : 'UNKNOWN';

  if (!eventId) {
    return json({ error: 'missing_event_id' }, 400);
  }

  const { data: existingEventRows } = await supabaseAdmin
    .from('paypal_webhook_events')
    .select('event_id, status')
    .eq('event_id', eventId)
    .limit(1);

  if (existingEventRows?.length) {
    return json({ ok: true, deduplicated: true });
  }

  const now = new Date().toISOString();

  const { error: insertEventError } = await supabaseAdmin.from('paypal_webhook_events').insert({
    event_id: eventId,
    event_type: eventType,
    resource_id: typeof (eventPayload.resource as Record<string, unknown> | undefined)?.id === 'string'
      ? (eventPayload.resource as Record<string, unknown>).id
      : null,
    payload: eventPayload,
    status: 'pending',
    received_at: now,
  });

  if (insertEventError) {
    return json({ error: insertEventError.message }, 500);
  }

  if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    const captureData = extractCaptureData(eventPayload);
    if (captureData.captureId && captureData.orderId) {
      const { data: requestRows } = await supabaseAdmin
        .from('credit_purchase_requests')
        .select('id, user_id, package_id, status, paypal_capture_id')
        .eq('provider', 'paypal')
        .eq('paypal_order_id', captureData.orderId)
        .order('created_at', { ascending: false })
        .limit(1);

      const requestRow = requestRows?.[0] ?? null;

      if (requestRow) {
        if (requestRow.status !== 'completed') {
          const { data: granted, error: grantError } = await supabaseAdmin.rpc('grant_purchase_credits', {
            target_user: requestRow.user_id,
            package_key: requestRow.package_id,
            provider_name: 'paypal',
            provider_payment_id: captureData.captureId,
          });

          if (!grantError) {
            await supabaseAdmin
              .from('credit_purchase_requests')
              .update({
                status: 'completed',
                provider_payment_id: captureData.captureId,
                paypal_capture_id: captureData.captureId,
                payer_email: captureData.payerEmail,
                amount_value: captureData.value,
                currency: captureData.currency,
                processed_at: now,
                updated_at: now,
                metadata: {
                  source: 'paypal-webhook',
                  grantedCredits: typeof granted === 'number' ? granted : null,
                },
              })
              .eq('id', requestRow.id);
          } else {
            await supabaseAdmin
              .from('credit_purchase_requests')
              .update({
                status: 'failed',
                metadata: {
                  source: 'paypal-webhook',
                  error: grantError.message,
                },
                processed_at: now,
                updated_at: now,
              })
              .eq('id', requestRow.id);
          }
        }
      }
    }
  }

  await supabaseAdmin
    .from('paypal_webhook_events')
    .update({
      status: 'processed',
      processed_at: now,
    })
    .eq('event_id', eventId);

  return json({ ok: true });
});
