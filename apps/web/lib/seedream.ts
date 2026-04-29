'use client';

import { getSupabaseConfig } from '@/lib/supabase';
import { ensureAccessToken } from '@/lib/supabaseEdge';

type SeedreamInput = {
  image: string;
  mask?: string;
  size?: string;
  includeDebug?: boolean;
  countryCode?: string;
};

type SeedreamDebug = {
  prompt?: string;
  size?: string;
  modelAlias?: string;
  modelId?: string;
  provider?: 'seedream' | 'openai';
};

type SeedreamOutput = {
  b64?: string;
  url?: string;
  newCredits?: number;
  modelAlias?: string;
  debug?: SeedreamDebug;
  error?: string;
  message?: string;
};

const COUNTRY_COOKIE_KEY = 'miri-country';

const normalizeCountryCode = (value: string | null | undefined) => {
  const normalized = (value ?? '').trim().toUpperCase();
  return normalized || undefined;
};

const getCountryCodeFromCookie = () => {
  if (typeof document === 'undefined') {
    return undefined;
  }

  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (const part of cookies) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${COUNTRY_COOKIE_KEY}=`)) {
      continue;
    }

    return normalizeCountryCode(
      decodeURIComponent(trimmed.slice(COUNTRY_COOKIE_KEY.length + 1))
    );
  }

  return undefined;
};

export const getClientCountryCode = () => getCountryCodeFromCookie();

export const callSeedreamProxy = async (payload: SeedreamInput) => {
  const token = await ensureAccessToken();
  const { url } = getSupabaseConfig();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  const response = await fetch(`${url}/functions/v1/seedream-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({
      ...payload,
      countryCode: payload.countryCode ?? getCountryCodeFromCookie(),
    }),
  });

  const json = (await response.json().catch(() => ({}))) as SeedreamOutput;

  if (!response.ok) {
    const message = json.message ?? json.error ?? `HTTP ${response.status}`;
    const error = new Error(message);
    (error as Error & { code?: string }).code = json.error;
    throw error;
  }

  if (!json.b64 && !json.url) {
    throw new Error('No image returned');
  }

  const outputImage = json.b64 ? `data:image/jpeg;base64,${json.b64}` : (json.url as string);

  return {
    image: outputImage,
    newCredits: json.newCredits,
    modelAlias: json.modelAlias,
    debug: json.debug,
  };
};
