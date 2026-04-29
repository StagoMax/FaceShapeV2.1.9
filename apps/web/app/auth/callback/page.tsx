'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { getRuntimeErrorMessage, translateRuntimeError } from '@/lib/i18n/runtime';
import { supabase } from '@/lib/supabase';
import { useAppDispatch } from '@/store/hooks';
import { fetchCurrentUser } from '@/store/slices/authSlice';

const normalizeNextPath = (value: string | null) => {
  if (!value || !value.startsWith('/')) {
    return '/';
  }
  if (value.startsWith('//')) {
    return '/';
  }
  return value;
};

const parseHash = () => {
  if (typeof window === 'undefined' || !window.location.hash) {
    return null;
  }
  const raw = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(raw);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  return { accessToken, refreshToken };
};

export default function AuthCallbackPage() {
  const { t } = useI18n();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [statusText, setStatusText] = useState(t('auth.callbackTitle'));

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
        const code = url?.searchParams.get('code');
        const nextPath = normalizeNextPath(url?.searchParams.get('next') ?? '/');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
        } else {
          const hashToken = parseHash();
          if (hashToken?.accessToken && hashToken.refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: hashToken.accessToken,
              refresh_token: hashToken.refreshToken,
            });
            if (error) {
              throw error;
            }
          }
        }

        await dispatch(fetchCurrentUser()).unwrap();
        if (active) {
          router.replace(nextPath);
        }
      } catch (error) {
        if (active) {
          const msg = getRuntimeErrorMessage(error, t('errors.unknown'));
          setStatusText(translateRuntimeError(msg, t) ?? t('errors.unknown'));
          setTimeout(() => {
            router.replace('/login');
          }, 1400);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [dispatch, router, t]);

  return (
    <main className="auth-page">
      <div className="card auth-card">
        <h1 className="title">{t('auth.callbackTitle')}</h1>
        <p className="subtitle">{statusText}</p>
      </div>
    </main>
  );
}
