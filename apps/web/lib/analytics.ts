'use client';

import { track } from '@vercel/analytics';

const SRC_STORAGE_KEY = 'miri_web_attribution_src';

type AnalyticsPayloadValue = string | number | boolean | null | undefined;
type AnalyticsPayload = Record<string, AnalyticsPayloadValue>;

type AttributionContext = {
  src: string | null;
  referrerHost: string | null;
};

const normalizeSourceValue = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 80) : null;
};

const readStoredSource = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return normalizeSourceValue(window.localStorage.getItem(SRC_STORAGE_KEY));
  } catch {
    return null;
  }
};

const persistSource = (value: string | null) => {
  if (typeof window === 'undefined' || !value) {
    return;
  }
  try {
    window.localStorage.setItem(SRC_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures and keep runtime-only attribution.
  }
};

const readReferrerSource = () => {
  if (typeof window === 'undefined' || !document.referrer) {
    return null;
  }
  try {
    const url = new URL(document.referrer);
    return normalizeSourceValue(url.searchParams.get('src') ?? url.searchParams.get('utm_source'));
  } catch {
    return null;
  }
};

const readReferrerHost = () => {
  if (typeof window === 'undefined' || !document.referrer) {
    return null;
  }
  try {
    return new URL(document.referrer).host || null;
  } catch {
    return null;
  }
};

export const getAttributionContext = (): AttributionContext => {
  if (typeof window === 'undefined') {
    return { src: null, referrerHost: null };
  }

  const params = new URLSearchParams(window.location.search);
  const paramSource = normalizeSourceValue(params.get('src') ?? params.get('utm_source'));
  if (paramSource) {
    persistSource(paramSource);
  }

  const referrerSource = readReferrerSource();
  if (!paramSource && referrerSource) {
    persistSource(referrerSource);
  }

  return {
    src: paramSource ?? referrerSource ?? readStoredSource(),
    referrerHost: readReferrerHost(),
  };
};

export const trackEvent = (eventName: string, payload: AnalyticsPayload = {}) => {
  if (typeof window === 'undefined') {
    return;
  }

  const attribution = getAttributionContext();
  const mergedPayload: AnalyticsPayload = {
    ...payload,
    src: attribution.src ?? undefined,
    referrerHost: attribution.referrerHost ?? undefined,
  };

  track(eventName, mergedPayload);
};
