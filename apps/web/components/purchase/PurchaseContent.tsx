'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CREDITS, PAYPAL } from '@miriai/config';
import type { CreditPackage, PaypalCheckoutCurrency } from '@miriai/types';
import PaypalCheckout from '@/components/payments/PaypalCheckout';
import { useI18n } from '@/lib/i18n/provider';
import { translateRuntimeError } from '@/lib/i18n/runtime';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectUser } from '@/store/slices/authSlice';
import {
  fetchCreditBalance,
  selectCreditBalance,
  selectCreditError,
  selectCreditLoading,
} from '@/store/slices/creditSlice';

const LANGUAGE_FALLBACK_LOCALE = {
  zh: 'zh-CN',
  'zh-TW': 'zh-TW',
  en: 'en-US',
  ja: 'ja-JP',
} as const;

const REGION_TO_CURRENCY: Partial<Record<string, PaypalCheckoutCurrency>> = {
  HK: 'HKD',
  JP: 'JPY',
  SG: 'SGD',
};

const TIMEZONE_TO_CURRENCY: Partial<Record<string, PaypalCheckoutCurrency>> = {
  'Asia/Hong_Kong': 'HKD',
  'Asia/Tokyo': 'JPY',
  'Asia/Singapore': 'SGD',
};

const CURRENCY_FRACTION_DIGITS: Record<PaypalCheckoutCurrency, number> = {
  USD: 2,
  HKD: 2,
  SGD: 2,
  JPY: 0,
};

const getFallbackLocale = (language: string) =>
  LANGUAGE_FALLBACK_LOCALE[language as keyof typeof LANGUAGE_FALLBACK_LOCALE] ?? 'en-US';

const extractRegionFromLocale = (locale: string) => {
  const parts = locale.replace('_', '-').split('-');
  const regionPart = parts.slice(1).find((part) => /^[A-Za-z]{2}$/.test(part));

  return regionPart?.toUpperCase() ?? null;
};

const resolveCheckoutCurrency = ({
  countryCode,
  locale,
  timeZone,
}: {
  countryCode?: string | null;
  locale: string;
  timeZone?: string;
}): PaypalCheckoutCurrency => {
  const normalizedCountryCode = countryCode?.trim().toUpperCase() ?? '';
  if (normalizedCountryCode && REGION_TO_CURRENCY[normalizedCountryCode]) {
    return REGION_TO_CURRENCY[normalizedCountryCode];
  }

  const region = extractRegionFromLocale(locale);
  if (region && REGION_TO_CURRENCY[region]) {
    return REGION_TO_CURRENCY[region];
  }

  if (timeZone && TIMEZONE_TO_CURRENCY[timeZone]) {
    return TIMEZONE_TO_CURRENCY[timeZone];
  }

  return PAYPAL.CURRENCY;
};

const getCheckoutAmount = (priceUsd: number, currency: PaypalCheckoutCurrency) =>
  Number((priceUsd * PAYPAL.SETTLEMENT_RATES[currency]).toFixed(CURRENCY_FRACTION_DIGITS[currency]));

const formatCurrency = (value: number, currency: PaypalCheckoutCurrency, locale: string) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: currency === 'USD' ? 'symbol' : 'code',
    minimumFractionDigits: CURRENCY_FRACTION_DIGITS[currency],
    maximumFractionDigits: CURRENCY_FRACTION_DIGITS[currency],
  }).format(value);

type PurchaseContentProps = {
  initialCountryCode?: string | null;
};

export default function PurchaseContent({ initialCountryCode = null }: PurchaseContentProps) {
  const { t, language } = useI18n();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const balance = useAppSelector(selectCreditBalance);
  const loadingBalance = useAppSelector(selectCreditLoading);
  const creditError = useAppSelector(selectCreditError);

  const [selectedId, setSelectedId] = useState<CreditPackage['id']>(CREDITS.PACKAGES[1]?.id ?? CREDITS.PACKAGES[0].id);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [displayLocale, setDisplayLocale] = useState<string>(() => getFallbackLocale(language));
  const [checkoutCurrency, setCheckoutCurrency] = useState<PaypalCheckoutCurrency>(() =>
    resolveCheckoutCurrency({
      countryCode: initialCountryCode,
      locale: getFallbackLocale(language),
    })
  );

  useEffect(() => {
    dispatch(fetchCreditBalance());
  }, [dispatch]);

  useEffect(() => {
    const fallbackLocale = getFallbackLocale(language);

    if (typeof window === 'undefined') {
      setDisplayLocale(fallbackLocale);
      setCheckoutCurrency(
        resolveCheckoutCurrency({
          countryCode: initialCountryCode,
          locale: fallbackLocale,
        })
      );
      return;
    }

    const detectedLocale = window.navigator.language || fallbackLocale;
    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    setDisplayLocale(detectedLocale);
    setCheckoutCurrency(
      resolveCheckoutCurrency({
        countryCode: initialCountryCode,
        locale: detectedLocale,
        timeZone: detectedTimeZone,
      })
    );
  }, [initialCountryCode, language]);

  const selectedPackage = useMemo(
    () => CREDITS.PACKAGES.find((pkg) => pkg.id === selectedId) ?? CREDITS.PACKAGES[0],
    [selectedId]
  );

  const selectedCheckoutPrice = useMemo(
    () => formatCurrency(getCheckoutAmount(selectedPackage.priceUsd, checkoutCurrency), checkoutCurrency, displayLocale),
    [checkoutCurrency, displayLocale, selectedPackage.priceUsd]
  );

  const handleSuccess = useCallback((result: { status: string }) => {
    if (result.status === 'completed') {
      setFeedback(t('purchase.success'));
      setShowSuccessModal(true);
    } else {
      setFeedback(t('purchase.pending'));
    }
    dispatch(fetchCreditBalance());
  }, [dispatch, t]);

  const handleError = useCallback((message: string) => {
    setFeedback(translateRuntimeError(message, t) ?? t('errors.unknown'));
  }, [t]);

  return (
    <main className="app-main">
      <div className="card purchase-card">
        <div className="kicker">{t('purchase.kicker')}</div>
        <h1 className="title">{t('purchase.title')}</h1>
        <p className="subtitle">{t('purchase.subtitle')}</p>

        <div className="purchase-info-overview">
          <div className="purchase-info-pill-row">
            <span className="purchase-info-pill">{t('purchase.creditRule')}</span>
            <span className="purchase-info-pill purchase-info-pill-emphasis">{t('purchase.starterHint')}</span>
          </div>
        </div>

        <div className="balance-row">
          <span>{t('purchase.currentCredits')}</span>
          <strong>{loadingBalance ? '...' : user?.credits ?? balance}</strong>
        </div>

        <div className="package-grid">
          {CREDITS.PACKAGES.map((pkg) => {
            const active = pkg.id === selectedId;
            return (
              <button
                key={pkg.id}
                className={active ? 'package-card package-card-active' : 'package-card'}
                onClick={() => {
                  setSelectedId(pkg.id);
                  setFeedback(null);
                  setShowSuccessModal(false);
                }}
              >
                {pkg.popular ? <span className="badge">{t('purchase.starterBadge')}</span> : null}
                <div className="package-credits">{pkg.credits}</div>
                <div className="package-unit">{t('purchase.creditsUnit')}</div>
                <div className="package-price">
                  {formatCurrency(getCheckoutAmount(pkg.priceUsd, checkoutCurrency), checkoutCurrency, displayLocale)}
                </div>
              </button>
            );
          })}
        </div>

        <div className="checkout-panel">
          <p className="purchase-info-checkout-summary">
            {t('purchase.summary', { credits: selectedPackage.credits, price: selectedCheckoutPrice })}
          </p>
          <PaypalCheckout
            packageId={selectedPackage.id}
            currency={checkoutCurrency}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </div>

        {feedback ? <p className="info-text">{feedback}</p> : null}
        {creditError ? <p className="error-text">{translateRuntimeError(creditError, t)}</p> : null}
      </div>

      {showSuccessModal ? (
        <div className="modal-overlay">
          <div className="modal-card purchase-success-modal">
            <h2>{t('auth.success')}</h2>
            <p>{t('purchase.success')}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="button"
                onClick={() => setShowSuccessModal(false)}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
