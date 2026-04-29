import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';

type VerifyRequest = {
  packageName: string;
  productId: string;
  purchaseToken: string;
  orderId?: string;
  userId?: string;
};

type PurchaseVerification = {
  purchaseState?: number | string | null;
  consumptionState?: number | string | null;
  acknowledgementState?: number | string | null;
  orderId?: string | null;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '';
const serviceRoleKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  Deno.env.get('SUPABASE_SECRET_KEY') ||
  Deno.env.get('SERVICE_ROLE_KEY') ||
  '';
const serviceAccountRaw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT') || '';
const expectedPackageName = Deno.env.get('GOOGLE_PLAY_PACKAGE_NAME') || '';

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const maskTokenHint = (value?: string | null) => {
  if (!value) {
    return null;
  }
  if (value.length <= 10) {
    return `${value}***(${value.length})`;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}(${value.length})`;
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

const parseServiceAccount = (raw: string) => {
  const parsed = JSON.parse(raw) as {
    client_email?: string;
    private_key?: string;
  };
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Invalid GOOGLE_PLAY_SERVICE_ACCOUNT payload');
  }
  return {
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, '\n'),
  };
};

const textEncoder = new TextEncoder();

const toBase64Url = (input: Uint8Array | string) => {
  const bytes = typeof input === 'string' ? textEncoder.encode(input) : input;
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const importPrivateKey = async (pem: string) => {
  const cleaned = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return await crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
};

let cachedToken: string | null = null;
let cachedTokenExpiry = 0;

const getAccessToken = async () => {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < cachedTokenExpiry - 60) {
    return cachedToken;
  }

  const { clientEmail, privateKey } = parseServiceAccount(serviceAccountRaw);
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    textEncoder.encode(signingInput)
  );
  const jwt = `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error_description || json?.error || 'Failed to fetch access token');
  }

  cachedToken = json.access_token as string;
  cachedTokenExpiry = now + Number(json.expires_in ?? 3600);
  return cachedToken;
};

const fetchGooglePurchase = async (
  accessToken: string,
  packageName: string,
  productId: string,
  purchaseToken: string
): Promise<PurchaseVerification> => {
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}` +
    `/purchases/products/${productId}/tokens/${purchaseToken}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.error?.message || `Google API error (${response.status})`;
    throw new Error(message);
  }
  return json as PurchaseVerification;
};

serve(async (req) => {
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: 'supabase_config_missing', message: 'Missing PROJECT_URL or SERVICE_ROLE_KEY' },
      500
    );
  }
  if (!serviceAccountRaw) {
    return jsonResponse(
      { error: 'google_play_config_missing', message: 'Missing GOOGLE_PLAY_SERVICE_ACCOUNT' },
      500
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let payload: VerifyRequest;
  try {
    payload = await req.json();
  } catch (_) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!payload?.packageName || !payload?.productId || !payload?.purchaseToken) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }
  if (expectedPackageName && payload.packageName !== expectedPackageName) {
    console.warn('[verify-google-play] package mismatch', {
      expected: expectedPackageName,
      got: payload.packageName,
      productId: payload.productId,
      tokenHint: maskTokenHint(payload.purchaseToken),
    });
    return jsonResponse({ error: 'Package mismatch' }, 400);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!bearer) {
    console.warn('[verify-google-play] missing bearer', {
      productId: payload.productId,
      tokenHint: maskTokenHint(payload.purchaseToken),
    });
    return jsonResponse({ error: 'Missing authorization' }, 401);
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(bearer);
  if (userError || !userData.user) {
    console.warn('[verify-google-play] invalid user session', {
      message: userError?.message ?? null,
      productId: payload.productId,
      tokenHint: maskTokenHint(payload.purchaseToken),
    });
    return jsonResponse({ error: 'Invalid user session' }, 401);
  }

  if (payload.userId && payload.userId !== userData.user.id) {
    console.warn('[verify-google-play] user mismatch', {
      payloadUserId: payload.userId,
      tokenUserId: userData.user.id,
      productId: payload.productId,
    });
    return jsonResponse({ error: 'User mismatch' }, 403);
  }

  const userId = userData.user.id;
  const purchaseToken = payload.purchaseToken;
  console.log('[verify-google-play] request', {
    userId,
    productId: payload.productId,
    packageName: payload.packageName,
    orderId: payload.orderId ?? null,
    tokenHint: maskTokenHint(purchaseToken),
  });

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from('credit_purchase_requests')
    .select('id, status, user_id, package_id')
    .eq('provider', 'google_play')
    .eq('provider_payment_id', purchaseToken)
    .order('created_at', { ascending: false })
    .limit(1);

  if (existingError) {
    return jsonResponse({ error: existingError.message }, 500);
  }

  const existing = existingRows?.[0] ?? null;
  if (existing) {
    if (existing.user_id !== userId) {
      console.warn('[verify-google-play] token linked to different user', {
        tokenHint: maskTokenHint(purchaseToken),
        existingUserId: existing.user_id,
        userId,
      });
      return jsonResponse({ error: 'Purchase token already linked' }, 403);
    }
    if (existing.package_id && existing.package_id !== payload.productId) {
      console.warn('[verify-google-play] package mismatch (existing)', {
        existingPackage: existing.package_id,
        payloadPackage: payload.productId,
        tokenHint: maskTokenHint(purchaseToken),
      });
      return jsonResponse({ error: 'Purchase package mismatch' }, 400);
    }
    if (existing.status === 'completed') {
      let currentCredits = 0;
      try {
        currentCredits = await fetchCurrentCredits(supabaseAdmin, userId);
      } catch (creditsError) {
        const message = creditsError instanceof Error ? creditsError.message : String(creditsError);
        return jsonResponse({ error: message }, 500);
      }
      return jsonResponse({
        status: 'completed',
        newCredits: currentCredits,
        requestId: existing.id,
        alreadyProcessed: true,
      });
    }
  }

  const { data: existingTxRows, error: existingTxError } = await supabaseAdmin
    .from('credit_transactions')
    .select('id, user_id')
    .eq('stripe_payment_id', purchaseToken)
    .limit(1);

  if (existingTxError) {
    return jsonResponse({ error: existingTxError.message }, 500);
  }

  const existingTx = existingTxRows?.[0] ?? null;
  if (existingTx) {
    if (existingTx.user_id !== userId) {
      console.warn('[verify-google-play] transaction linked to different user', {
        tokenHint: maskTokenHint(purchaseToken),
        existingUserId: existingTx.user_id,
        userId,
      });
      return jsonResponse({ error: 'Purchase token already linked' }, 403);
    }
    if (existing?.id && existing.status !== 'completed') {
      await supabaseAdmin
        .from('credit_purchase_requests')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    let currentCredits = 0;
    try {
      currentCredits = await fetchCurrentCredits(supabaseAdmin, userId);
    } catch (creditsError) {
      const message = creditsError instanceof Error ? creditsError.message : String(creditsError);
      return jsonResponse({ error: message }, 500);
    }
    return jsonResponse({
      status: 'completed',
      newCredits: currentCredits,
      requestId: existing?.id ?? null,
      alreadyProcessed: true,
    });
  }

  let verification: PurchaseVerification;
  try {
    const accessToken = await getAccessToken();
    verification = await fetchGooglePurchase(
      accessToken,
      payload.packageName,
      payload.productId,
      purchaseToken
    );
  } catch (error) {
    console.warn('[verify-google-play] google api error', {
      message: error instanceof Error ? error.message : String(error),
      productId: payload.productId,
      tokenHint: maskTokenHint(purchaseToken),
    });
    return jsonResponse({ error: error instanceof Error ? error.message : 'Verification failed' }, 502);
  }

  const purchaseState = Number(verification.purchaseState ?? -1);
  if (Number.isNaN(purchaseState) || purchaseState !== 0) {
    if (existing?.id) {
      await supabaseAdmin
        .from('credit_purchase_requests')
        .update({
          status: purchaseState === 2 ? 'pending' : 'failed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    }
    return jsonResponse(
      {
        status: purchaseState === 2 ? 'pending' : 'failed',
        error: purchaseState === 2 ? 'Purchase pending' : 'Purchase not completed',
      },
      400
    );
  }

  if (payload.orderId && verification.orderId && payload.orderId !== verification.orderId) {
    console.warn('[verify-google-play] order mismatch', {
      payloadOrderId: payload.orderId,
      googleOrderId: verification.orderId,
      productId: payload.productId,
      tokenHint: maskTokenHint(purchaseToken),
    });
    return jsonResponse({ error: 'Order mismatch' }, 400);
  }

  let requestId = existing?.id ?? null;
  if (!requestId) {
    const { data: requestRow, error: insertError } = await supabaseAdmin
      .from('credit_purchase_requests')
      .insert({
        user_id: userId,
        package_id: payload.productId,
        provider: 'google_play',
        provider_payment_id: purchaseToken,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      const { data: conflictRows, error: conflictError } = await supabaseAdmin
        .from('credit_purchase_requests')
        .select('id, status, user_id, package_id')
        .eq('provider', 'google_play')
        .eq('provider_payment_id', purchaseToken)
        .order('created_at', { ascending: false })
        .limit(1);

      if (conflictError || !conflictRows?.length) {
        return jsonResponse({ error: insertError.message }, 500);
      }

      const conflict = conflictRows[0];
      if (conflict.user_id !== userId) {
        return jsonResponse({ error: 'Purchase token already linked' }, 403);
      }
      if (conflict.package_id && conflict.package_id !== payload.productId) {
        return jsonResponse({ error: 'Purchase package mismatch' }, 400);
      }
      requestId = conflict.id;
    } else {
      requestId = requestRow.id;
    }
  }

  const { data: newCredits, error: grantError } = await supabaseAdmin.rpc(
    'grant_purchase_credits',
    {
      target_user: userId,
      package_key: payload.productId,
      provider_name: 'google_play',
      provider_payment_id: purchaseToken,
    }
  );

  if (grantError) {
    await supabaseAdmin
      .from('credit_purchase_requests')
      .update({ status: 'failed', processed_at: new Date().toISOString() })
      .eq('id', requestId);
    console.warn('[verify-google-play] grant credits failed', {
      message: grantError.message,
      productId: payload.productId,
      requestId,
    });
    return jsonResponse({ error: grantError.message }, 500);
  }

  await supabaseAdmin
    .from('credit_purchase_requests')
    .update({ status: 'completed', processed_at: new Date().toISOString() })
    .eq('id', requestId);

  return jsonResponse({
    status: 'completed',
    newCredits: typeof newCredits === 'number' ? newCredits : 0,
    requestId,
  });
});
