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
  signUpWithPassword,
} from '@/store/slices/authSlice';

const normalizeNextPath = (value: string | null) => {
  if (!value || !value.startsWith('/')) {
    return '/';
  }
  if (value.startsWith('//')) {
    return '/';
  }
  return value;
};

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectAuthLoading);
  const authError = useAppSelector(selectAuthError);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    if (password !== confirmPassword) {
      setLocalError(t('auth.passwordMismatch'));
      return;
    }

    try {
      const result = await dispatch(
        signUpWithPassword({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        })
      ).unwrap();

      if (result.status === 'email_already_registered') {
        setLocalError(t('auth.emailAlreadyRegistered'));
        setPassword('');
        setConfirmPassword('');
        return;
      }

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

  const displayError = translateRuntimeError(localError ?? authError, t);

  return (
    <main className="auth-page">
      <div className="card auth-card">
        <div className="kicker">{t('common.appName')}</div>
        <h1 className="title">{t('auth.signUp')}</h1>
        <form className="auth-form" onSubmit={submit}>
          <label className="field-label">{t('auth.name')}</label>
          <input
            className="field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
          <label className="field-label">{t('auth.confirmPassword')}</label>
          <input
            className="field-input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {displayError ? <p className="error-text">{displayError}</p> : null}
          <button className="button auth-submit" type="submit" disabled={loading}>
            {loading ? t('common.processing') : t('auth.signUp')}
          </button>
        </form>
        <button className="button button-secondary auth-google" onClick={loginWithGoogle} disabled={loading}>
          {t('auth.withGoogle')}
        </button>
        <p className="auth-switch">
          {t('auth.hasAccount')}{' '}
          <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>{t('auth.goLogin')}</Link>
        </p>
      </div>
    </main>
  );
}
