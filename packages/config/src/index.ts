import type { CreditPackage, LanguageCode, PaypalCheckoutCurrency } from '@miriai/types';

export const APP_NAME = 'Miri';

export const LEGAL_VERSIONS = {
  PRIVACY_POLICY: '2026-01-19',
  TERMS_OF_SERVICE: '2026-01-19',
} as const;

export const SUPPORTED_LANGUAGES: LanguageCode[] = ['zh', 'zh-TW', 'en', 'ja'];

export const PAYPAL = {
  CURRENCY: 'USD' as PaypalCheckoutCurrency,
  SUPPORTED_CURRENCIES: ['USD', 'HKD', 'SGD', 'JPY'] as PaypalCheckoutCurrency[],
  SETTLEMENT_RATES: {
    USD: 1,
    HKD: 7.8,
    SGD: 1.35,
    JPY: 150,
  } as Record<PaypalCheckoutCurrency, number>,
} as const;

export const WEB_IMAGE_RULES = {
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  MAX_SIDE: 2048,
  MIN_SIDE: 512,
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const;

export const CREDITS = {
  COSTS: {
    AI_EDIT: 1,
  },
  PACKAGES: [
    { id: 'credits_10', credits: 10, priceUsd: 0.99 },
    { id: 'credits_50', credits: 50, priceUsd: 3.99, popular: true },
    { id: 'credits_150', credits: 150, priceUsd: 9.99 },
    { id: 'credits_400', credits: 400, priceUsd: 19.99 },
  ] as CreditPackage[],
} as const;
