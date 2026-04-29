import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';

const SEEDREAM_ENDPOINT = 'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations';
const OPENAI_IMAGES_EDITS_ENDPOINT = 'https://api.openai.com/v1/images/edits';
const DEFAULT_MODEL_ID_5_0_260128 = 'seedream-5-0-260128';
const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-1.5';
const OPENAI_DEFAULT_SIZE = 'auto';
const OPENAI_DEFAULT_QUALITY = 'high';
const OPENAI_OUTPUT_FORMAT = 'jpeg';
const OPENAI_OUTPUT_COMPRESSION = '92';
const OPENAI_COUNTRY_CODES = new Set(['US']);

type Provider = 'seedream' | 'openai';

type GeneratePayload = {
  image?: string;
  mask?: string;
  size?: string;
  includeDebug?: boolean;
  countryCode?: string;
};

type ResolvedModel =
  | {
      ok: true;
      alias: string;
      modelId: string;
    }
  | {
      ok: false;
      error: string;
      message: string;
    };

type GenerateDebug = {
  prompt?: string;
  size?: string;
  modelAlias?: string;
  modelId?: string;
  provider?: Provider;
};

type GenerateResult =
  | {
      ok: true;
      b64?: string;
      url?: string;
      debug?: GenerateDebug;
    }
  | {
      ok: false;
      error: string;
      message: string;
      status: number;
      refundReason: string;
    };

const normalizeCountryCode = (countryCode: string | undefined) => {
  const normalized = String(countryCode ?? '').trim().toUpperCase();
  return normalized || undefined;
};

const resolveProvider = (countryCode: string | undefined): Provider =>
  OPENAI_COUNTRY_CODES.has(normalizeCountryCode(countryCode) ?? '') ? 'openai' : 'seedream';

const inferSeedreamModelAlias = (modelId: string) => {
  if (modelId.includes('seedream-5-0')) {
    return 'seedream-5.0-lite';
  }
  if (modelId.includes('seedream-4-5')) {
    return 'seedream-4.5';
  }
  if (modelId.includes('seedream-4-0')) {
    return 'seedream-4.0';
  }
  return modelId;
};

const resolveSeedreamModelId = (): ResolvedModel => {
  const modelId = (Deno.env.get('SEEDREAM_MODEL') ?? DEFAULT_MODEL_ID_5_0_260128).trim();
  if (!modelId) {
    return {
      ok: false,
      error: 'seedream_model_not_configured',
      message: 'Global model seedream-5.0-lite is not configured',
    };
  }

  return {
    ok: true,
    alias: inferSeedreamModelAlias(modelId),
    modelId,
  };
};

const resolveOpenAiModelId = (): ResolvedModel => {
  const modelId = (Deno.env.get('OPENAI_IMAGE_MODEL') ?? DEFAULT_OPENAI_IMAGE_MODEL).trim();
  if (!modelId) {
    return {
      ok: false,
      error: 'openai_model_not_configured',
      message: 'US image model is not configured',
    };
  }

  return {
    ok: true,
    alias: modelId,
    modelId,
  };
};

const SEEDREAM_MIN_PIXELS = 2560 * 1440;
const SEEDREAM_MAX_PIXELS = 4096 * 4096;
const SEEDREAM_MIN_ASPECT_RATIO = 1 / 16;
const SEEDREAM_MAX_ASPECT_RATIO = 16;
const SEEDREAM_DEFAULT_SIZE = '2K';

const normalizeSeedreamSize = (size: string | undefined) => {
  const normalized = String(size ?? '').trim();
  if (!normalized) {
    return SEEDREAM_DEFAULT_SIZE;
  }

  const preset = normalized.toUpperCase();
  if (preset === '2K' || preset === '4K') {
    return preset;
  }

  const match = normalized.match(/^(\d{2,5})x(\d{2,5})$/i);
  if (!match) {
    return SEEDREAM_DEFAULT_SIZE;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  const pixels = width * height;
  const ratio = width / height;
  const isValid =
    pixels >= SEEDREAM_MIN_PIXELS &&
    pixels <= SEEDREAM_MAX_PIXELS &&
    ratio >= SEEDREAM_MIN_ASPECT_RATIO &&
    ratio <= SEEDREAM_MAX_ASPECT_RATIO;

  return isValid ? `${width}x${height}` : SEEDREAM_DEFAULT_SIZE;
};

const normalizeOpenAiSize = (size: string | undefined) => {
  const normalized = String(size ?? '').trim();
  if (!normalized) {
    return OPENAI_DEFAULT_SIZE;
  }

  const preset = normalized.toUpperCase();
  if (preset === '2K' || preset === '4K') {
    return OPENAI_DEFAULT_SIZE;
  }

  const match = normalized.match(/^(\d{2,5})x(\d{2,5})$/i);
  if (!match) {
    return OPENAI_DEFAULT_SIZE;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width === height) {
    return '1024x1024';
  }

  return width > height ? '1536x1024' : '1024x1536';
};

const CREDIT_COST = 1;
const CREDIT_DESCRIPTION = 'AI image generation';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  Deno.env.get('SUPABASE_SECRET_KEY') ||
  Deno.env.get('SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const textResponse = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: corsHeaders,
  });

const createSupabaseAdmin = () =>
  createClient(supabaseUrl, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const refundCredits = async (userId: string, modelAlias: string, reason: string) => {
  const supabaseAdmin = createSupabaseAdmin();
  await supabaseAdmin.from('credit_transactions').insert({
    user_id: userId,
    transaction_type: 'purchase',
    amount: CREDIT_COST,
    description: `Refund: ${CREDIT_DESCRIPTION} (${modelAlias}, ${reason})`,
  });
};

const OPENAI_PROMPT_SUFFIX = [
  'Modify only the masked region.',
  'Preserve the exact identity, skin tone, white balance, color temperature, exposure, lighting direction, background, and camera perspective.',
  'Do not relight, recolor, or restyle unmasked areas.',
].join(' ');

const resolvePrompt = (provider: Provider) => {
  if (provider === 'openai') {
    const basePrompt = (Deno.env.get('OPENAI_IMAGE_PROMPT') ?? Deno.env.get('SEEDREAM_PROMPT') ?? '').trim();
    if (!basePrompt) {
      return '';
    }
    return `${basePrompt}\n\n${OPENAI_PROMPT_SUFFIX}`;
  }

  return (Deno.env.get('SEEDREAM_PROMPT') ?? '').trim();
};

const resolveSeedreamApiKey = () => (Deno.env.get('SEEDREAM_API_KEY') ?? '').trim();
const resolveOpenAiApiKey = () => (Deno.env.get('OPENAI_API_KEY') ?? '').trim();

const buildImageFile = async (image: string) => {
  const normalized = image.trim();
  if (!normalized) {
    throw new Error('Missing image');
  }

  if (normalized.startsWith('data:')) {
    const match = normalized.match(/^data:([^;,]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid data URL image');
    }

    const mimeType = match[1] || 'image/png';
    const base64 = match[2];
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const extension = mimeType.split('/')[1] || 'png';
    return new File([bytes], `input.${extension}`, { type: mimeType });
  }

  const response = await fetch(normalized);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const blob = await response.blob();
  const mimeType = blob.type || 'image/png';
  const extension = mimeType.split('/')[1] || 'png';
  return new File([blob], `input.${extension}`, { type: mimeType });
};

const generateWithSeedream = async ({
  image,
  size,
  includeDebug,
  prompt,
  resolvedModel,
  apiKey,
}: {
  image: string;
  size: string | undefined;
  includeDebug: boolean;
  prompt: string;
  resolvedModel: Extract<ResolvedModel, { ok: true }>;
  apiKey: string;
}): Promise<GenerateResult> => {
  const normalizedSize = normalizeSeedreamSize(size);
  const body = {
    model: resolvedModel.modelId,
    prompt,
    image,
    size: normalizedSize,
    response_format: 'b64_json',
    sequential_image_generation: 'disabled',
    stream: false,
    optimize_prompt_options: { mode: 'standard' },
    watermark: false,
  };

  const resp = await fetch(SEEDREAM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return {
      ok: false,
      error: 'seedream_upstream_error',
      message: json?.error?.message || json?.message || `HTTP ${resp.status}`,
      status: resp.status,
      refundReason: 'seedream_error',
    };
  }

  const b64 = json?.data?.[0]?.b64_json;
  const url = json?.data?.[0]?.url;

  if (!b64 && !url) {
    return {
      ok: false,
      error: 'seedream_empty_response',
      message: 'No image returned',
      status: 502,
      refundReason: 'empty_response',
    };
  }

  return {
    ok: true,
    b64,
    url,
    debug: includeDebug
      ? {
          prompt,
          size: normalizedSize,
          modelAlias: resolvedModel.alias,
          modelId: resolvedModel.modelId,
          provider: 'seedream',
        }
      : undefined,
  };
};

const generateWithOpenAi = async ({
  image,
  mask,
  size,
  includeDebug,
  prompt,
  resolvedModel,
  apiKey,
  userId,
}: {
  image: string;
  mask?: string;
  size: string | undefined;
  includeDebug: boolean;
  prompt: string;
  resolvedModel: Extract<ResolvedModel, { ok: true }>;
  apiKey: string;
  userId: string;
}): Promise<GenerateResult> => {
  let imageFile: File;
  try {
    imageFile = await buildImageFile(image);
  } catch (error) {
    return {
      ok: false,
      error: 'invalid_image',
      message: error instanceof Error ? error.message : 'Invalid image',
      status: 400,
      refundReason: 'prepare_image_failed',
    };
  }

  let maskFile: File | null = null;
  if (mask) {
    try {
      maskFile = await buildImageFile(mask);
    } catch (error) {
      return {
        ok: false,
        error: 'invalid_mask',
        message: error instanceof Error ? error.message : 'Invalid mask',
        status: 400,
        refundReason: 'prepare_mask_failed',
      };
    }
  }

  const normalizedSize = normalizeOpenAiSize(size);
  const formData = new FormData();
  formData.set('model', resolvedModel.modelId);
  formData.set('prompt', prompt);
  formData.set('size', normalizedSize);
  formData.set('input_fidelity', 'high');
  formData.set('quality', OPENAI_DEFAULT_QUALITY);
  formData.set('output_format', OPENAI_OUTPUT_FORMAT);
  formData.set('output_compression', OPENAI_OUTPUT_COMPRESSION);
  formData.set('n', '1');
  formData.set('user', userId);
  formData.append('image[]', imageFile);
  if (maskFile) {
    formData.set('mask', maskFile);
  }

  const resp = await fetch(OPENAI_IMAGES_EDITS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return {
      ok: false,
      error: 'openai_upstream_error',
      message: json?.error?.message || json?.message || `HTTP ${resp.status}`,
      status: resp.status,
      refundReason: 'openai_error',
    };
  }

  const firstImage = Array.isArray(json?.data) ? json.data[0] : undefined;
  const b64 = firstImage?.b64_json ?? firstImage?.image_base64;
  const url = firstImage?.url;

  if (!b64 && !url) {
    return {
      ok: false,
      error: 'openai_empty_response',
      message: 'No image returned',
      status: 502,
      refundReason: 'empty_response',
    };
  }

  return {
    ok: true,
    b64,
    url,
    debug: includeDebug
      ? {
          prompt,
          size: normalizedSize,
          modelAlias: resolvedModel.alias,
          modelId: resolvedModel.modelId,
          provider: 'openai',
        }
      : undefined,
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return textResponse('ok');
  }

  if (req.method !== 'POST') {
    return textResponse('Method Not Allowed', 405);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token) {
    return jsonResponse({ error: 'auth_missing_jwt', message: 'Missing JWT' }, 401);
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(
      {
        error: 'supabase_config_missing',
        message: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY',
      },
      500
    );
  }

  if (!serviceRoleKey) {
    return jsonResponse(
      {
        error: 'service_role_missing',
        message: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY',
      },
      500
    );
  }

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: authData, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !authData?.user) {
    return jsonResponse({ error: 'auth_invalid_jwt', message: 'Invalid JWT' }, 401);
  }

  let payload: GeneratePayload = {};
  try {
    payload = await req.json();
  } catch (_) {
    return jsonResponse({ error: 'invalid_json', message: 'Invalid JSON body' }, 400);
  }

  if (!payload.image) {
    return jsonResponse({ error: 'missing_image', message: 'Missing image' }, 400);
  }

  const provider = resolveProvider(payload.countryCode);
  const prompt = resolvePrompt(provider);
  if (!prompt) {
    return jsonResponse(
      {
        error: provider === 'openai' ? 'openai_prompt_missing' : 'seedream_config_missing',
        message:
          provider === 'openai'
            ? 'Missing OPENAI_IMAGE_PROMPT or SEEDREAM_PROMPT'
            : 'Missing SEEDREAM_PROMPT',
      },
      500
    );
  }

  const providerApiKey = provider === 'openai' ? resolveOpenAiApiKey() : resolveSeedreamApiKey();
  if (!providerApiKey) {
    return jsonResponse(
      {
        error: provider === 'openai' ? 'openai_config_missing' : 'seedream_config_missing',
        message: provider === 'openai' ? 'Missing OPENAI_API_KEY' : 'Missing SEEDREAM_API_KEY',
      },
      500
    );
  }

  const resolvedModel = provider === 'openai' ? resolveOpenAiModelId() : resolveSeedreamModelId();
  if (!resolvedModel.ok) {
    return jsonResponse(
      {
        error: resolvedModel.error,
        message: resolvedModel.message,
      },
      500
    );
  }

  const { data: newCredits, error: consumeError } = await supabaseUser.rpc(
    'consume_user_credits',
    {
      credit_amount: CREDIT_COST,
      description_text: `${CREDIT_DESCRIPTION} (${resolvedModel.alias})`,
    }
  );
  if (consumeError) {
    const message = consumeError.message || 'Failed to consume credits';
    const isInsufficient = message.toLowerCase().includes('insufficient');
    return jsonResponse(
      {
        error: isInsufficient ? 'insufficient_credits' : 'credit_consume_failed',
        message,
      },
      isInsufficient ? 402 : 500
    );
  }

  const result =
    provider === 'openai'
      ? await generateWithOpenAi({
          image: payload.image,
          mask: payload.mask,
          size: payload.size,
          includeDebug: Boolean(payload.includeDebug),
          prompt,
          resolvedModel,
          apiKey: providerApiKey,
          userId: authData.user.id,
        })
      : await generateWithSeedream({
          image: payload.image,
          size: payload.size,
          includeDebug: Boolean(payload.includeDebug),
          prompt,
          resolvedModel,
          apiKey: providerApiKey,
        });

  if (!result.ok) {
    await refundCredits(authData.user.id, resolvedModel.alias, result.refundReason);
    return jsonResponse(
      {
        error: result.error,
        message: result.message,
        status: result.status,
      },
      result.status
    );
  }

  return jsonResponse({
    b64: result.b64,
    url: result.url,
    newCredits,
    modelAlias: resolvedModel.alias,
    debug: result.debug,
  });
});
