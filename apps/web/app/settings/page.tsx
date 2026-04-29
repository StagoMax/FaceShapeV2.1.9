'use client';

import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { SUPPORTED_LANGUAGES } from '@miriai/config';
import { useI18n } from '@/lib/i18n/provider';
import { LANGUAGE_LABELS } from '@/lib/i18n/shared';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectUser, signOut } from '@/store/slices/authSlice';

function SettingsContent() {
  const { t, language, setLanguage } = useI18n();
  const user = useAppSelector(selectUser);
  const dispatch = useAppDispatch();

  return (
    <main className="app-main">
      <div className="card settings-card">
        <h1 className="title">{t('settings.title')}</h1>

        <section className="settings-section">
          <h2>{t('settings.account')}</h2>
          <p>{t('settings.signedInAs', { email: user?.email ?? '-' })}</p>
          <button
            className="button button-secondary"
            onClick={async () => {
              await dispatch(signOut()).unwrap().catch(() => null);
              window.location.href = '/';
            }}
          >
            {t('nav.logout')}
          </button>
        </section>

        <section className="settings-section">
          <h2>{t('settings.language')}</h2>
          <div className="lang-list">
            {SUPPORTED_LANGUAGES.map((code) => (
              <button
                key={code}
                className={code === language ? 'lang-pill lang-pill-active' : 'lang-pill'}
                onClick={() => setLanguage(code)}
              >
                {LANGUAGE_LABELS[code]}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h2>{t('settings.policy')}</h2>
          <div className="policy-links">
            <Link href="/privacy">{t('settings.openPrivacy')}</Link>
            <Link href="/terms">{t('settings.openTerms')}</Link>
            <Link href="/account-deletion">{t('settings.accountDeletion')}</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}
