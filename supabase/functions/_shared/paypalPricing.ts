export const DEFAULT_PAYPAL_CURRENCY = 'USD' as const;

export const PAYPAL_SETTLEMENT_RATES = {
  USD: 1,
  HKD: 7.8,
  SGD: 1.35,
  JPY: 150,
} as const;

const PAYPAL_CURRENCY_FRACTION_DIGITS = {
  USD: 2,
  HKD: 2,
  SGD: 2,
  JPY: 0,
} as const;

export type PaypalCheckoutCurrency = keyof typeof PAYPAL_SETTLEMENT_RATES;

export const isPaypalCheckoutCurrency = (value: string): value is PaypalCheckoutCurrency =>
  value in PAYPAL_SETTLEMENT_RATES;

export const normalizePaypalCheckoutCurrency = (value?: string | null): PaypalCheckoutCurrency => {
  if (value && isPaypalCheckoutCurrency(value)) {
    return value;
  }

  return DEFAULT_PAYPAL_CURRENCY;
};

export const getPaypalCurrencyFractionDigits = (currency: PaypalCheckoutCurrency) =>
  PAYPAL_CURRENCY_FRACTION_DIGITS[currency];

export const getPaypalCheckoutAmount = (priceUsd: number, currency: PaypalCheckoutCurrency) => {
  const fractionDigits = getPaypalCurrencyFractionDigits(currency);
  return Number((priceUsd * PAYPAL_SETTLEMENT_RATES[currency]).toFixed(fractionDigits));
};

export const formatPaypalCheckoutAmount = (priceUsd: number, currency: PaypalCheckoutCurrency) =>
  getPaypalCheckoutAmount(priceUsd, currency).toFixed(getPaypalCurrencyFractionDigits(currency));
