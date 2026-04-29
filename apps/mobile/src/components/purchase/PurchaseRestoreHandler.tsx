import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { finishTransaction, getAvailablePurchases, initConnection } from 'react-native-iap';

import { CREDITS } from '../../constants';
import { AppDispatch } from '../../store';
import { selectIsAuthenticated, selectUser, updateUserCredits } from '../../store/slices/authSlice';
import { purchaseCredits } from '../../store/slices/creditSlice';

const PurchaseRestoreHandler = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  const initializedRef = useRef(false);
  const processedTokensRef = useRef<Set<string>>(new Set());
  const lastUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    if (!isAuthenticated || !user) {
      return;
    }

    let cancelled = false;

    const restorePurchases = async () => {
      try {
        if (!initializedRef.current) {
          await initConnection();
          initializedRef.current = true;
        }

        if (lastUserRef.current !== user.id) {
          processedTokensRef.current.clear();
          lastUserRef.current = user.id;
        }

        const purchases = await getAvailablePurchases({
          alsoPublishToEventListenerIOS: false,
          onlyIncludeActiveItemsIOS: true,
        });

        if (cancelled || !purchases?.length) {
          return;
        }

        const validIds = new Set<string>(CREDITS.PACKAGES.map((pkg) => pkg.id));

        for (const purchase of purchases) {
          const productId = purchase.productId;
          if (!productId || !validIds.has(productId)) {
            continue;
          }
          if (purchase.purchaseState !== 'purchased') {
            continue;
          }

          const token = purchase.purchaseToken ?? '';
          if (!token || processedTokensRef.current.has(token)) {
            continue;
          }
          processedTokensRef.current.add(token);

          try {
            const result = await dispatch(
              purchaseCredits({
                packageId: productId,
                purchaseToken: token,
                orderId: purchase.transactionId ?? undefined,
              })
            ).unwrap();

            if (result.status === 'completed') {
              try {
                await finishTransaction({ purchase, isConsumable: true });
              } catch (finishError) {
                console.warn('[purchase] finishTransaction failed', finishError);
              }
            }

            if (typeof result.newCredits === 'number') {
              dispatch(updateUserCredits(result.newCredits));
            }
          } catch (error) {
            console.warn('[purchase] restore purchase failed', error);
          }
        }
      } catch (error) {
        console.warn('[purchase] restore getAvailablePurchases failed', error);
      }
    };

    restorePurchases();

    return () => {
      cancelled = true;
    };
  }, [dispatch, isAuthenticated, user]);

  return null;
};

export default PurchaseRestoreHandler;
