import { SUPPORTED_LANGUAGES } from '@miriai/config';
import type { LanguageCode } from '@miriai/types';

export const DEFAULT_LANGUAGE: LanguageCode = 'en';
export const LANGUAGE_STORAGE_KEY = 'miri_web_language';
export const LANGUAGE_COOKIE_KEY = LANGUAGE_STORAGE_KEY;
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  zh: '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
};

export const LANGUAGE_TAGS: Record<LanguageCode, string> = {
  zh: 'zh-CN',
  'zh-TW': 'zh-TW',
  en: 'en',
  ja: 'ja',
};

export const OPEN_GRAPH_LOCALES: Record<LanguageCode, string> = {
  zh: 'zh_CN',
  'zh-TW': 'zh_TW',
  en: 'en_US',
  ja: 'ja_JP',
};

export const normalizeLanguageCode = (value: string | null | undefined): LanguageCode | null => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'zh' || normalized.startsWith('zh-cn') || normalized.startsWith('zh-sg')) {
    return 'zh';
  }
  if (normalized === 'zh-tw' || normalized.startsWith('zh-hk') || normalized.startsWith('zh-mo')) {
    return 'zh-TW';
  }
  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en';
  }
  if (normalized === 'ja' || normalized.startsWith('ja-')) {
    return 'ja';
  }

  return null;
};

export const isSupportedLanguage = (value: string | null | undefined): value is LanguageCode => {
  if (!value) {
    return false;
  }
  return SUPPORTED_LANGUAGES.includes(value as LanguageCode);
};

export const resolveLanguageFromAcceptLanguage = (acceptLanguage: string | null | undefined): LanguageCode | null => {
  if (!acceptLanguage) {
    return null;
  }

  const tokens = acceptLanguage
    .split(',')
    .map((part) => part.split(';')[0]?.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const resolved = normalizeLanguageCode(token);
    if (resolved) {
      return resolved;
    }
  }

  return null;
};

export const resolveClientLanguage = ({
  savedLanguage,
  cookieLanguage,
  initialLanguage,
  navigatorLanguage,
}: {
  savedLanguage?: string | null;
  cookieLanguage?: string | null;
  initialLanguage?: LanguageCode | null;
  navigatorLanguage?: string | null;
}): LanguageCode => {
  return (
    normalizeLanguageCode(savedLanguage) ??
    normalizeLanguageCode(cookieLanguage) ??
    initialLanguage ??
    normalizeLanguageCode(navigatorLanguage) ??
    DEFAULT_LANGUAGE
  );
};

export const writeLanguageCookie = (language: LanguageCode) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${LANGUAGE_COOKIE_KEY}=${language}; Max-Age=${LANGUAGE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
};

export const readLanguageCookie = () => {
  if (typeof document === 'undefined') {
    return null;
  }

  const parts = document.cookie.split(';');
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === LANGUAGE_COOKIE_KEY) {
      return rest.join('=') || null;
    }
  }

  return null;
};
