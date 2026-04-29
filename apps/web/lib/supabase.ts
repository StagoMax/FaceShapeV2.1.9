'use client';

import { createClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = 'https://placeholder.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'placeholder-anon-key';

const toValidHttpUrl = (value: string | undefined) => {
  const normalized = (value ?? '').trim();
  if (!normalized) {
    return null;
  }
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    return null;
  }
  return null;
};

const envSupabaseUrl = toValidHttpUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const envSupabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

const supabaseUrl = envSupabaseUrl ?? FALLBACK_SUPABASE_URL;
const supabaseAnonKey = envSupabaseAnonKey || FALLBACK_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export const getSupabaseConfig = () => {
  if (!envSupabaseUrl || !envSupabaseAnonKey) {
    throw new Error(
      'Missing web Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  return {
    url: envSupabaseUrl,
  };
};

export const hasSupabaseEnv = () =>
  Boolean(envSupabaseUrl && envSupabaseAnonKey);
