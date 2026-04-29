export type LanguageCode = 'zh' | 'zh-TW' | 'en' | 'ja';

export type PaymentProvider = 'google_play' | 'paypal';

export type CreditPackageId = 'credits_10' | 'credits_50' | 'credits_150' | 'credits_400';
export type PaypalCheckoutCurrency = 'USD' | 'HKD' | 'SGD' | 'JPY';

export interface CreditPackage {
  id: CreditPackageId;
  credits: number;
  priceUsd: number;
  popular?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  is_anonymous?: boolean;
  credits: number;
  free_uses_remaining: number;
  ai_consent_at?: string | null;
  privacy_policy_version?: string | null;
  terms_of_service_version?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PaypalCreateOrderRequest {
  packageId: CreditPackageId;
  currency: PaypalCheckoutCurrency;
}

export interface PaypalCreateOrderResponse {
  orderId: string;
  currency: PaypalCheckoutCurrency;
  amount: string;
  approveLink?: string;
}

export interface PaypalCaptureOrderRequest {
  orderId: string;
  packageId: CreditPackageId;
  currency: PaypalCheckoutCurrency;
}

export interface PaypalCaptureOrderResponse {
  status: 'pending' | 'completed' | 'failed';
  newCredits?: number;
  requestId?: string | null;
  alreadyProcessed?: boolean;
  error?: string;
}
