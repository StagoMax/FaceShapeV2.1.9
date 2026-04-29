'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';

type Status = 'verifying' | 'verified' | 'invalid';

const APP_DEEP_LINK = 'miri://auth/callback';

const getRawParams = () => {
  if (typeof window === 'undefined') {
    return '';
  }
  if (window.location.hash) {
    return window.location.hash.replace(/^#/, '');
  }
  return window.location.search.replace(/^\?/, '');
};

const isMobileDevice = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

export default function AuthConfirmPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState(t('authConfirm.checkingMessage'));

  const rawParams = useMemo(() => getRawParams(), []);
  const isMobile = useMemo(() => isMobileDevice(), []);
  const deepLink = rawParams ? `${APP_DEEP_LINK}#${rawParams}` : APP_DEEP_LINK;

  useEffect(() => {
    const params = new URLSearchParams(rawParams);
    const hasTokens =
      (params.get('access_token') && params.get('refresh_token')) || params.get('code');

    if (hasTokens) {
      setStatus('verified');
      setMessage(
        isMobile
          ? t('authConfirm.verifiedMessageMobile')
          : t('authConfirm.verifiedMessageDesktop')
      );
    } else {
      setStatus('invalid');
      setMessage(t('authConfirm.invalidMessage'));
    }
  }, [isMobile, rawParams, t]);

  const handleOpenApp = () => {
    if (typeof window === 'undefined') {
      return;
    }
    window.location.href = deepLink;
  };

  return (
    <main>
      <div className="card">
        <div className="kicker">
          {status === 'verified'
            ? t('authConfirm.verifiedKicker')
            : status === 'invalid'
              ? t('authConfirm.invalidKicker')
              : t('authConfirm.verifyingKicker')}
        </div>
        <h1 className="title">{t('authConfirm.title')}</h1>
        <p className="subtitle">{message}</p>
        {status === 'verified' && isMobile && (
          <>
            <div className="actions">
              <button className="button" onClick={handleOpenApp}>
                {t('authConfirm.openApp')}
              </button>
            </div>
            <p className="subtitle" style={{ marginTop: 12, color: '#8e8e93', fontSize: 14 }}>
              {t('authConfirm.installHint')}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
