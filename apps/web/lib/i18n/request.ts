import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import type { LanguageCode } from '@miriai/types';
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE_KEY, normalizeLanguageCode, resolveLanguageFromAcceptLanguage } from './shared';

const COUNTRY_HEADER_KEY = 'x-miri-country';

export const resolveRequestLanguage = cache(async (): Promise<LanguageCode> => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const cookieLanguage = normalizeLanguageCode(cookieStore.get(LANGUAGE_COOKIE_KEY)?.value);
  if (cookieLanguage) {
    return cookieLanguage;
  }

  const countryCode = (headerStore.get(COUNTRY_HEADER_KEY) ?? '').trim().toUpperCase();
  if (countryCode === 'JP') {
    return 'ja';
  }

  const headerLanguage = resolveLanguageFromAcceptLanguage(headerStore.get('accept-language'));
  if (headerLanguage) {
    return headerLanguage;
  }

  return DEFAULT_LANGUAGE;
});
