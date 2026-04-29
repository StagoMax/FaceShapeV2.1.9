'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { getRuntimeErrorMessage, translateRuntimeError } from '@/lib/i18n/runtime';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearAuthError,
  selectAuthError,
  selectAuthLoading,
  signInWithGoogle,
  signInWithPassword,
} from '@/store/slices/authSlice';

const isIgnorableAuthError = (message: string | null | undefined) =>
  Boolean(
    message &&
      /auth session missing|session missing|refresh token.*(missing|not found)|invalid refresh token/i.test(
        message
      )
  );

const normalizeNextPath = (value: string | null) => {
  if (!value || !value.startsWith('/')) {
    return '/';
  }
  if (value.startsWith('//')) {
    return '/';
  }
  return value;
};

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectAuthLoading);
  const authError = useAppSelector(selectAuthError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState('/');

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const next = normalizeNextPath(new URLSearchParams(window.location.search).get('next'));
    setNextPath(next);
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    try {
      await dispatch(signInWithPassword({ email: email.trim(), password })).unwrap();
      router.replace(nextPath);
    } catch (error) {
      setLocalError(getRuntimeErrorMessage(error, t('errors.unknown')));
    }
  };

  const loginWithGoogle = async () => {
    setLocalError(null);
    try {
      await dispatch(signInWithGoogle({ nextPath })).unwrap();
    } catch (error) {
      setLocalError(getRuntimeErrorMessage(error, t('errors.unknown')));
    }
  };

  const displayError = translateRuntimeError(localError ?? (isIgnorableAuthError(authError) ? null : authError), t);

  return (
    <main className="auth-page">
      <div className="card auth-card">
        <div className="kicker">{t('common.appName')}</div>
        <h1 className="title">{t('auth.signIn')}</h1>
        <form className="auth-form" onSubmit={submit}>
          <label className="field-label">{t('auth.email')}</label>
          <input
            className="field-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label className="field-label">{t('auth.password')}</label>
          <input
            className="field-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {displayError ? <p className="error-text">{displayError}</p> : null}
          <button className="button auth-submit" type="submit" disabled={loading}>
            {loading ? t('common.processing') : t('auth.signIn')}
          </button>
        </form>
        <button className="button button-secondary auth-google" onClick={loginWithGoogle} disabled={loading}>
          {t('auth.withGoogle')}
        </button>
        <p className="auth-switch">
          {t('auth.noAccount')}{' '}
          <Link href={`/register?next=${encodeURIComponent(nextPath)}`}>{t('auth.goRegister')}</Link>
        </p>
      </div>
    </main>
  );
}
