'use client';

import { useEffect, useRef, useState } from 'react';
import type { CreditPackageId, PaypalCaptureOrderResponse, PaypalCheckoutCurrency } from '@miriai/types';
import { trackEvent } from '@/lib/analytics';
import { translateClientMessage } from '@/lib/i18n/runtime';
import { loadPaypalScript } from '@/lib/paypal';
import { supabase } from '@/lib/supabase';
import { useAppDispatch } from '@/store/hooks';
import { capturePaypalOrder, createPaypalOrder } from '@/store/slices/creditSlice';

const DEBUG_STORAGE_KEY = 'miri_purchase_paypal_debug';
const MAX_DEBUG_LOGS = 24;

type PaypalCheckoutProps = {
  packageId: CreditPackageId;
  currency: PaypalCheckoutCurrency;
  onSuccess: (result: PaypalCaptureOrderResponse) => void;
  onError: (message: string) => void;
  onDebug?: (message: string) => void;
};

export default function PaypalCheckout({ packageId, currency, onSuccess, onError, onDebug }: PaypalCheckoutProps) {
  const dispatch = useAppDispatch();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const preparedOrderIdRef = useRef<string | null>(null);
  const [renderNonce, setRenderNonce] = useState(0);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onDebugRef = useRef(onDebug);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onDebugRef.current = onDebug;
  }, [onDebug]);

  useEffect(() => {
    let cancelled = false;
    let buttons: { close: () => void } | null = null;
    const persistDebugLine = (line: string) => {
      if (typeof window === 'undefined') {
        return;
      }

      try {
        const raw = window.sessionStorage.getItem(DEBUG_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        const existing = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
        const next = [...existing.slice(-(MAX_DEBUG_LOGS - 1)), line];
        window.sessionStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage failures; console + parent callback still provide visibility.
      }
    };

    const logDebug = (message: string) => {
      const line = `[${new Date().toLocaleTimeString()}] ${message}`;
      console.log('[PaypalCheckout]', line);
      persistDebugLine(line);
      onDebugRef.current?.(line);
    };

    const remountButtons = (reason: string) => {
      preparedOrderIdRef.current = null;
      logDebug(`resetting buttons -> ${reason}`);
      setRenderNonce((value) => value + 1);
    };

    const mount = async () => {
      const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
      if (!clientId) {
        logDebug('Missing NEXT_PUBLIC_PAYPAL_CLIENT_ID');
        onErrorRef.current(translateClientMessage('errors.missingPayPalClientId'));
        return;
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          logDebug(`supabase.auth.getSession failed: ${sessionError.message}`);
        } else {
          const expiresAt = sessionData.session?.expires_at
            ? new Date(sessionData.session.expires_at * 1000).toISOString()
            : 'none';
          logDebug(`session present=${sessionData.session ? 'yes' : 'no'}, expiresAt=${expiresAt}`);
        }

        logDebug('Loading PayPal JS SDK');
        await loadPaypalScript(clientId, currency);
        if (cancelled || !containerRef.current || !window.paypal?.Buttons) {
          logDebug('PayPal SDK load cancelled or Buttons unavailable');
          return;
        }

        containerRef.current.innerHTML = '';
        logDebug(`Rendering PayPal buttons for package=${packageId}, currency=${currency}`);

        const paypalButtons = window.paypal.Buttons({
          style: {
            shape: 'pill',
            color: 'gold',
            layout: 'vertical',
            label: 'paypal',
          },
          onClick: async (
            _data: unknown,
            actions: { resolve?: () => Promise<void> | void; reject?: () => Promise<void> | void }
          ) => {
            preparedOrderIdRef.current = null;
            try {
              trackEvent('purchase_started', { source: 'paypal_button', packageId });
              logDebug(`onClick -> creating order for ${packageId} in ${currency}`);
              const created = await dispatch(createPaypalOrder({ packageId, currency })).unwrap();
              preparedOrderIdRef.current = created.orderId;
              logDebug(`onClick -> order created: ${created.orderId}`);
              return actions.resolve?.();
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              logDebug(`onClick -> create order failed: ${message}`);
              onErrorRef.current(message);
              remountButtons('create-order-failed');
              return actions.reject?.();
            }
          },
          createOrder: async () => {
            if (preparedOrderIdRef.current) {
              logDebug(`createOrder -> using prepared orderId: ${preparedOrderIdRef.current}`);
              return preparedOrderIdRef.current;
            }
            logDebug(`createOrder -> fallback create order for ${packageId} in ${currency}`);
            const created = await dispatch(createPaypalOrder({ packageId, currency })).unwrap();
            preparedOrderIdRef.current = created.orderId;
            logDebug(`createOrder -> fallback order created: ${created.orderId}`);
            return created.orderId;
          },
          onApprove: async (data: { orderID?: string }) => {
            if (!data.orderID) {
              logDebug('onApprove -> missing orderID from PayPal');
              throw new Error(translateClientMessage('errors.missingOrderIdFromPayPal'));
            }
            logDebug(`onApprove -> capturing order ${data.orderID}`);
            const captured = await dispatch(
              capturePaypalOrder({
                orderId: data.orderID,
                packageId,
                currency,
              })
            ).unwrap();
            preparedOrderIdRef.current = null;
            logDebug(`onApprove -> capture finished with status=${captured.status}`);
            if (captured.status === 'completed') {
              trackEvent('purchase_success', { packageId });
            }
            onSuccessRef.current(captured);
          },
          onCancel: () => {
            preparedOrderIdRef.current = null;
            logDebug('onCancel -> payment cancelled');
            onErrorRef.current(translateClientMessage('errors.paymentCancelled'));
            remountButtons('cancelled');
          },
          onError: (error: unknown) => {
            preparedOrderIdRef.current = null;
            const message = error instanceof Error ? error.message : String(error);
            logDebug(`onError -> ${message}`);
            onErrorRef.current(message);
            remountButtons('sdk-error');
          },
        });

        buttons = paypalButtons;
        await paypalButtons.render(containerRef.current);
        logDebug('PayPal buttons rendered');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logDebug(`mount failed: ${message}`);
        if (!cancelled) {
          onErrorRef.current(message);
        }
      }
    };

    void mount();

    return () => {
      cancelled = true;
      if (buttons) {
        buttons.close();
      }
    };
  }, [currency, dispatch, packageId, renderNonce]);

  return <div ref={containerRef} />;
}
