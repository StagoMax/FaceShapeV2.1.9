import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type MergeRequest = {
  anonAccessToken?: string;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL');
const serviceRoleKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  Deno.env.get('SUPABASE_SECRET_KEY') ||
  Deno.env.get('SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing PROJECT_URL or SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!bearer) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: MergeRequest = {};
  try {
    payload = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!payload.anonAccessToken) {
    return new Response(JSON.stringify({ error: 'Missing anonAccessToken' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: targetData, error: targetError } = await supabaseAdmin.auth.getUser(bearer);
  if (targetError || !targetData.user) {
    return new Response(JSON.stringify({ error: 'Invalid user session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: anonData, error: anonError } = await supabaseAdmin.auth.getUser(
    payload.anonAccessToken
  );
  if (anonError || !anonData.user) {
    return new Response(JSON.stringify({ error: 'Invalid anonymous session' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!anonData.user.is_anonymous) {
    return new Response(JSON.stringify({ error: 'User is not anonymous' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const targetUserId = targetData.user.id;
  const anonUserId = anonData.user.id;

  if (targetUserId === anonUserId) {
    return new Response(JSON.stringify({ transferredCredits: 0, newCredits: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: anonProfile, error: anonProfileError } = await supabaseAdmin
    .from('user_profiles')
    .select('credits')
    .eq('id', anonUserId)
    .single();

  if (anonProfileError && anonProfileError.code !== 'PGRST116') {
    return new Response(JSON.stringify({ error: anonProfileError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const transferredCredits = Math.max(0, anonProfile?.credits ?? 0);
  if (transferredCredits <= 0) {
    return new Response(JSON.stringify({ transferredCredits: 0, newCredits: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
    .from('user_profiles')
    .select('credits')
    .eq('id', targetUserId)
    .single();

  if (targetProfileError && targetProfileError.code !== 'PGRST116') {
    return new Response(JSON.stringify({ error: targetProfileError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const baseCredits = targetProfile?.credits ?? 0;
  const newCredits = baseCredits + transferredCredits;
  const now = new Date().toISOString();

  const { error: upsertTargetError } = await supabaseAdmin
    .from('user_profiles')
    .upsert(
      { id: targetUserId, credits: newCredits, updated_at: now },
      { onConflict: 'id' }
    );

  if (upsertTargetError) {
    return new Response(JSON.stringify({ error: upsertTargetError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error: insertTxError } = await supabaseAdmin.from('credit_transactions').insert({
    user_id: targetUserId,
    transaction_type: 'purchase',
    amount: transferredCredits,
    description: `Merge from anonymous user ${anonUserId}`,
    created_at: now,
  });

  if (insertTxError) {
    return new Response(JSON.stringify({ error: insertTxError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error: zeroAnonError } = await supabaseAdmin
    .from('user_profiles')
    .upsert(
      { id: anonUserId, credits: 0, updated_at: now },
      { onConflict: 'id' }
    );

  if (zeroAnonError) {
    return new Response(JSON.stringify({ error: zeroAnonError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({ transferredCredits, newCredits }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
