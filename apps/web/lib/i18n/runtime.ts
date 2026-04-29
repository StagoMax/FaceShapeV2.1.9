import type { LanguageCode } from '@miriai/types';
import { MESSAGES, type MessageTree } from './messages';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, readLanguageCookie, resolveClientLanguage } from './shared';

const getNested = (obj: MessageTree, key: string): string | null => {
  const parts = key.split('.');
  let current: string | MessageTree | undefined = obj;
  for (const part of parts) {
    if (!current || typeof current === 'string') {
      return null;
    }
    current = current[part];
  }
  return typeof current === 'string' ? current : null;
};

export const translateMessage = (
  language: LanguageCode,
  key: string,
  vars?: Record<string, string | number>
) => {
  const raw = getNested(MESSAGES[language] ?? MESSAGES[DEFAULT_LANGUAGE], key) ?? getNested(MESSAGES.en, key) ?? key;
  if (!vars) {
    return raw;
  }
  return Object.entries(vars).reduce((acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)), raw);
};

export const getClientLanguage = (): LanguageCode => {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  return resolveClientLanguage({
    savedLanguage: window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
    cookieLanguage: readLanguageCookie(),
    navigatorLanguage: navigator.language,
  });
};

export const translateClientMessage = (key: string, vars?: Record<string, string | number>) =>
  translateMessage(getClientLanguage(), key, vars);

const ERROR_MESSAGE_KEYS: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /unsupported image format/i, key: 'errors.unsupportedImageFormat' },
  { pattern: /file too large/i, key: 'errors.fileTooLarge' },
  { pattern: /failed to load image/i, key: 'errors.failedToLoadImage' },
  { pattern: /failed to read file/i, key: 'errors.failedToReadFile' },
  { pattern: /failed to create canvas context/i, key: 'errors.failedToCreateCanvas' },
  { pattern: /failed to fetch user/i, key: 'errors.failedToFetchUser' },
  { pattern: /missing user after sign in/i, key: 'errors.missingUserAfterSignIn' },
  { pattern: /^sign in failed$/i, key: 'errors.signInFailed' },
  { pattern: /^sign up failed$/i, key: 'errors.signUpFailed' },
  { pattern: /^google sign in failed$/i, key: 'errors.googleSignInFailed' },
  { pattern: /^sign out failed$/i, key: 'errors.signOutFailed' },
  { pattern: /failed to fetch credit balance/i, key: 'errors.failedToFetchCreditBalance' },
  { pattern: /missing next_public_paypal_client_id|missing paypal client id/i, key: 'errors.missingPayPalClientId' },
  { pattern: /failed to load paypal sdk/i, key: 'errors.failedToLoadPayPalSdk' },
  { pattern: /failed to create paypal order/i, key: 'errors.failedToCreatePayPalOrder' },
  { pattern: /failed to capture paypal order/i, key: 'errors.failedToCapturePayPalOrder' },
  { pattern: /payment cancelled/i, key: 'errors.paymentCancelled' },
  { pattern: /missing orderid from paypal approval|missing order id from paypal approval/i, key: 'errors.missingOrderIdFromPayPal' },
];

export const translateRuntimeError = (
  message: string | null | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string
) => {
  if (!message) {
    return null;
  }

  const known = ERROR_MESSAGE_KEYS.find((entry) => entry.pattern.test(message));
  if (known) {
    return t(known.key);
  }

  return message;
};

export const getRuntimeErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};
