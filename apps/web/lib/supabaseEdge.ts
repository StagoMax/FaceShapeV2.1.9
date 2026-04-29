'use client';

import { getSupabaseConfig, supabase } from '@/lib/supabase';

const SESSION_EXPIRED_MESSAGE = 'Session expired. Please refresh the page and sign in again.';

const getAnonKey = () => {
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  if (!anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return anonKey;
};

const buildEdgeError = (message: string, status: number, payload: unknown) => {
  const error = new Error(message) as Error & {
    status?: number;
    payload?: unknown;
  };
  error.status = status;
  error.payload = payload;
  return error;
};

const extractErrorMessage = async (response: Response) => {
  const payload = await response.clone().json().catch(() => null) as
    | { message?: unknown; error?: unknown }
    | null;

  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return {
      message: payload.message,
      payload,
    };
  }

  if (typeof payload?.error === 'string' && payload.error.trim()) {
    return {
      message: payload.error,
      payload,
    };
  }

  const text = await response.clone().text().catch(() => '');
  if (text.trim()) {
    return {
      message: text,
      payload,
    };
  }

  return {
    message: `HTTP ${response.status}`,
    payload,
  };
};

export const ensureAccessToken = async (forceRefresh = false) => {
  if (!forceRefresh) {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error(SESSION_EXPIRED_MESSAGE);
    }
    if (data.session?.access_token) {
      return data.session.access_token;
    }
  }

  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session?.access_token) {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }
  return data.session.access_token;
};

export const invokeEdgeFunction = async <T>(functionName: string, body: unknown, attempt = 0): Promise<T> => {
  const token = await ensureAccessToken(attempt > 0);
  const { url } = getSupabaseConfig();
  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: getAnonKey(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    if (message === 'Invalid JWT' && attempt === 0) {
      return invokeEdgeFunction<T>(functionName, body, 1);
    }
    throw buildEdgeError(message, response.status, payload);
  }

  return response.json() as Promise<T>;
};
