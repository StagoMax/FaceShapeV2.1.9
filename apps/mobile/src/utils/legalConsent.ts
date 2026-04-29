import AsyncStorage from '@react-native-async-storage/async-storage';
import { LEGAL_VERSIONS, STORAGE_KEYS } from '../constants';

export type LegalConsentCache = {
  acceptedAt: string;
  privacyVersion: string;
  termsVersion: string;
};

const CONSENT_STORAGE_KEY = STORAGE_KEYS.AI_LEGAL_CONSENT;

const isMatchingVersions = (
  cache: LegalConsentCache | null,
  privacyVersion: string,
  termsVersion: string
) => {
  if (!cache) {
    return false;
  }
  if (!cache.acceptedAt) {
    return false;
  }
  return cache.privacyVersion === privacyVersion && cache.termsVersion === termsVersion;
};

const parseConsent = (raw: string | null): LegalConsentCache | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as LegalConsentCache;
    if (!parsed?.acceptedAt) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('[legal-consent] parse failed', error);
    return null;
  }
};

const loadConsent = async (): Promise<LegalConsentCache | null> => {
  try {
    const raw = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);
    return parseConsent(raw);
  } catch (error) {
    console.warn('[legal-consent] load failed', error);
    return null;
  }
};

const persistConsent = async (
  acceptedAt = new Date().toISOString(),
  privacyVersion = LEGAL_VERSIONS.PRIVACY_POLICY,
  termsVersion = LEGAL_VERSIONS.TERMS_OF_SERVICE
) => {
  const payload: LegalConsentCache = {
    acceptedAt,
    privacyVersion,
    termsVersion,
  };
  await AsyncStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
  return payload;
};

export const legalConsentManager = {
  load: loadConsent,
  hasValidConsent: async (
    privacyVersion = LEGAL_VERSIONS.PRIVACY_POLICY,
    termsVersion = LEGAL_VERSIONS.TERMS_OF_SERVICE
  ) => {
    const cache = await loadConsent();
    return isMatchingVersions(cache, privacyVersion, termsVersion);
  },
  persist: persistConsent,
};
