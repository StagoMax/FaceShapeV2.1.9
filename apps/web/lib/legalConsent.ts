'use client';

import { LEGAL_VERSIONS } from '@miriai/config';

type ConsentRecord = {
  acceptedAt: string;
  privacyVersion: string;
  termsVersion: string;
};

const CONSENT_KEY = 'miri_web_ai_consent';

export const legalConsent = {
  load(): ConsentRecord | null {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      const raw = window.localStorage.getItem(CONSENT_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as ConsentRecord;
      return parsed;
    } catch {
      return null;
    }
  },
  save(record: ConsentRecord) {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  },
  hasValidConsent() {
    const cache = this.load();
    if (!cache?.acceptedAt) {
      return false;
    }
    return (
      cache.privacyVersion === LEGAL_VERSIONS.PRIVACY_POLICY &&
      cache.termsVersion === LEGAL_VERSIONS.TERMS_OF_SERVICE
    );
  },
};

export const buildConsentRecordNow = (): ConsentRecord => ({
  acceptedAt: new Date().toISOString(),
  privacyVersion: LEGAL_VERSIONS.PRIVACY_POLICY,
  termsVersion: LEGAL_VERSIONS.TERMS_OF_SERVICE,
});
