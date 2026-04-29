'use client';

import { translateClientMessage } from '@/lib/i18n/runtime';

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: Record<string, unknown>) => {
        render: (container: HTMLElement | string) => Promise<void>;
        close: () => void;
      };
    };
  }
}

const PAYPAL_SCRIPT_ID = 'paypal-js-sdk';

export const loadPaypalScript = async (clientId: string, currency = 'USD') => {
  if (typeof window === 'undefined') {
    return;
  }

  const existing = document.getElementById(PAYPAL_SCRIPT_ID) as HTMLScriptElement | null;
  const currentCurrency = existing?.dataset.currency;

  if (window.paypal?.Buttons && currentCurrency === currency) {
    return;
  }

  if (existing && currentCurrency && currentCurrency !== currency) {
    existing.remove();
    delete (window as typeof window & { paypal?: unknown }).paypal;
  }

  const reusable = document.getElementById(PAYPAL_SCRIPT_ID) as HTMLScriptElement | null;
  if (reusable) {
    await new Promise<void>((resolve, reject) => {
      if ((window as typeof window & { paypal?: unknown }).paypal) {
        resolve();
        return;
      }
      reusable.addEventListener('load', () => resolve(), { once: true });
      reusable.addEventListener('error', () => reject(new Error(translateClientMessage('errors.failedToLoadPayPalSdk'))), {
        once: true,
      });
    });
    return;
  }

  const script = document.createElement('script');
  script.id = PAYPAL_SCRIPT_ID;
  script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(
    currency
  )}&intent=capture`;
  script.async = true;
  script.dataset.currency = currency;

  await new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(translateClientMessage('errors.failedToLoadPayPalSdk')));
    document.head.appendChild(script);
  });
};
