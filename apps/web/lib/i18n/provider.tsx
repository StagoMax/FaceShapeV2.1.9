'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LanguageCode } from '@miriai/types';
import { MESSAGES, type MessageTree } from './messages';
import {
  LANGUAGE_STORAGE_KEY,
  LANGUAGE_TAGS,
  readLanguageCookie,
  resolveClientLanguage,
  writeLanguageCookie,
} from './shared';

type I18nValue = {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

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

export function I18nProvider({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage: LanguageCode;
}) {
  const router = useRouter();
  const [language, setLanguageState] = useState<LanguageCode>(initialLanguage);

  useEffect(() => {
    setLanguageState(initialLanguage);
  }, [initialLanguage]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextLanguage = resolveClientLanguage({
      savedLanguage: window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
      cookieLanguage: readLanguageCookie(),
      initialLanguage,
      navigatorLanguage: navigator.language,
    });

    if (nextLanguage !== language) {
      setLanguageState(nextLanguage);
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
      writeLanguageCookie(nextLanguage);
      document.documentElement.lang = LANGUAGE_TAGS[nextLanguage];
      if (nextLanguage !== initialLanguage) {
        router.refresh();
      }
      return;
    }

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    writeLanguageCookie(nextLanguage);
    document.documentElement.lang = LANGUAGE_TAGS[nextLanguage];
  }, [initialLanguage, language, router]);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      writeLanguageCookie(lang);
      document.documentElement.lang = LANGUAGE_TAGS[lang];
      router.refresh();
    }
  };

  const value = useMemo<I18nValue>(() => {
    const t = (key: string, vars?: Record<string, string | number>) => {
      const langMessages = MESSAGES[language] ?? MESSAGES.zh;
      const raw = getNested(langMessages, key) ?? getNested(MESSAGES.en, key) ?? key;
      if (!vars) {
        return raw;
      }
      return Object.entries(vars).reduce((acc, [k, v]) => {
        return acc.replaceAll(`{{${k}}}`, String(v));
      }, raw);
    };

    return {
      language,
      setLanguage,
      t,
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside <I18nProvider>');
  }
  return context;
};
