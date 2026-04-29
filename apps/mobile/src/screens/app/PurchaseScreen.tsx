import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import {
  ErrorCode,
  finishTransaction,
  getAvailablePurchases as queryAvailablePurchases,
  type Product,
  type Purchase,
  type PurchaseError,
  useIAP,
} from 'react-native-iap';

import { COLORS, CREDITS, ROUTES, TYPOGRAPHY } from '../../constants';
import { purchaseCredits, selectCreditProcessing } from '../../store/slices/creditSlice';
import {
  selectUser,
  selectGuestCredits,
  selectIsAuthenticated,
  signInWithProvider,
  updateUserCredits,
} from '../../store/slices/authSlice';
import { AppDispatch } from '../../store';
import { useTranslation } from 'react-i18next';
import { supabaseHelpers } from '../../services/supabase';
import type { RootStackParamList } from '../../types';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';
import type { OAuthProvider } from '../../services/supabase';

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  originalPrice?: number;
  popular?: boolean;
  bonus?: number;
}

const maskPurchaseToken = (value?: string | null) => {
  if (!value) {
    return null;
  }
  if (value.length <= 10) {
    return `${value}***(${value.length})`;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}(${value.length})`;
};

const PurchaseScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Purchase'>>();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector(selectUser);
  const guestCredits = useSelector(selectGuestCredits);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isProcessing = useSelector(selectCreditProcessing);
  const { t } = useTranslation();

  const productIds = useMemo(() => CREDITS.PACKAGES.map((pkg) => pkg.id), []);
  const processingTokensRef = useRef<Set<string>>(new Set());
  const restoredTokensRef = useRef<Set<string>>(new Set());
  const restoreCheckedUserRef = useRef<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(() => {
    const popularPackage = CREDITS.PACKAGES.find((pkg) => ('popular' in pkg ? pkg.popular : false));
    return popularPackage?.id ?? CREDITS.PACKAGES[0]?.id ?? null;
  });
  const [latestCredits, setLatestCredits] = useState<number | null>(null);
  const [isRefreshingCredits, setIsRefreshingCredits] = useState(false);
  const [isAuthModalVisible, setIsAuthModalVisible] = useState(false);
  const [pendingAuthPackageId, setPendingAuthPackageId] = useState<string | null>(null);
  const [pendingPurchaseId, setPendingPurchaseId] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<OAuthProvider | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const resumeAttemptRef = useRef<string | null>(null);

  const processPurchase = useCallback(
    async (
      purchase: Purchase,
      options: { silent?: boolean; skipNavigation?: boolean } = {}
    ) => {
      const { silent = false, skipNavigation = false } = options;
      supabaseHelpers.logClientEvent('purchase_flow_received', {
        productId: purchase.productId ?? null,
        purchaseState: purchase.purchaseState ?? null,
        orderId: purchase.transactionId ?? null,
        tokenHint: maskPurchaseToken(purchase.purchaseToken),
        silent,
      });
      if (Platform.OS !== 'android') {
        if (!silent) {
          Alert.alert(t('purchase.purchaseFailedTitle'), t('purchase.storeUnavailable'));
        }
        return;
      }
      if (purchase.purchaseState !== 'purchased') {
        if (purchase.purchaseState === 'pending') {
          if (!silent) {
            Alert.alert(t('purchase.purchasePendingTitle'), t('purchase.purchasePendingMessage'));
          }
        }
        return;
      }

      const purchaseToken = purchase.purchaseToken ?? '';
      const packageId = purchase.productId;
      if (!purchaseToken || !packageId) {
        if (!silent) {
          Alert.alert(t('purchase.purchaseFailedTitle'), t('purchase.missingReceipt'));
        }
        return;
      }

      if (processingTokensRef.current.has(purchaseToken)) {
        return;
      }

      processingTokensRef.current.add(purchaseToken);
      setPendingPurchaseId(packageId);

      try {
        const result = await dispatch(
          purchaseCredits({
            packageId,
            purchaseToken,
            orderId: purchase.transactionId ?? undefined,
          })
        ).unwrap();

        if (result.status === 'completed') {
          supabaseHelpers.logClientEvent('purchase_flow_completed', {
            productId: packageId,
            newCredits: result.newCredits ?? null,
            orderId: purchase.transactionId ?? null,
          });
          try {
            await finishTransaction({ purchase, isConsumable: true });
          } catch (finishError) {
            console.warn('[purchase] finishTransaction failed', finishError);
            supabaseHelpers.logClientEvent('purchase_flow_finish_failed', {
              productId: packageId,
              message: finishError instanceof Error ? finishError.message : String(finishError),
            }, 'warn');
          }

          if (typeof result.newCredits === 'number') {
            setLatestCredits(result.newCredits);
          }
          if (!silent) {
            Alert.alert(
              t('purchase.purchaseSuccessTitle'),
              t('purchase.purchaseSuccessMessage', { credits: CREDITS.PACKAGES.find(pkg => pkg.id === packageId)?.credits ?? 0 })
            );
          }
        } else {
          supabaseHelpers.logClientEvent('purchase_flow_pending', {
            productId: packageId,
            orderId: purchase.transactionId ?? null,
          }, 'warn');
          if (!silent) {
            Alert.alert(t('purchase.purchasePendingTitle'), t('purchase.purchasePendingMessage'));
          }
        }
        if (!skipNavigation) {
          navigation.goBack();
        }
      } catch (error) {
        supabaseHelpers.logClientEvent('purchase_flow_failed', {
          productId: packageId,
          orderId: purchase.transactionId ?? null,
          message: error instanceof Error ? error.message : String(error),
        }, 'error');
        if (!silent) {
          Alert.alert(t('purchase.purchaseFailedTitle'), String(error));
        }
      } finally {
        processingTokensRef.current.delete(purchaseToken);
        setPendingPurchaseId(null);
      }
    },
    [dispatch, navigation, t]
  );

  const handleStorePurchaseSuccess = useCallback(
    async (purchase: Purchase) => {
      await processPurchase(purchase);
    },
    [processPurchase]
  );

  const restoreOwnedPurchases = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return;
    }
    if (!isAuthenticated || !user) {
      return;
    }
    supabaseHelpers.logClientEvent('purchase_restore_start', {
      userId: user.id,
    });

    try {
      const purchases = await queryAvailablePurchases({
        onlyIncludeActiveItemsIOS: true,
      });
      supabaseHelpers.logClientEvent('purchase_restore_fetched', {
        count: purchases?.length ?? 0,
      });
      if (!purchases?.length) {
        return;
      }

      const validIds = new Set<string>(productIds);
      purchases.forEach((purchase) => {
        const productId = purchase.productId;
        if (!productId || !validIds.has(productId)) {
          return;
        }
        if (purchase.purchaseState !== 'purchased') {
          return;
        }
        const token = purchase.purchaseToken ?? '';
        if (!token || restoredTokensRef.current.has(token)) {
          return;
        }
        restoredTokensRef.current.add(token);
        processPurchase(purchase, { silent: true, skipNavigation: true });
      });
    } catch (error) {
      console.warn('[purchase] restore owned purchases failed', error);
      supabaseHelpers.logClientEvent('purchase_restore_failed', {
        message: error instanceof Error ? error.message : String(error),
      }, 'warn');
    }
  }, [isAuthenticated, processPurchase, productIds, user]);

  const handleStorePurchaseError = useCallback(
    (error: PurchaseError) => {
      setPendingPurchaseId(null);
      supabaseHelpers.logClientEvent('purchase_flow_store_error', {
        code: error.code ?? null,
        message: error.message ?? null,
      }, 'warn');
      if (error.code === ErrorCode.UserCancelled) {
        return;
      }
      if (error.code === ErrorCode.AlreadyOwned || error.code === ErrorCode.AlreadyPrepared) {
        Alert.alert(t('purchase.purchasePendingTitle'), t('purchase.restoreOwnedMessage'));
        void restoreOwnedPurchases();
        return;
      }
      Alert.alert(t('purchase.purchaseFailedTitle'), error.message);
    },
    [restoreOwnedPurchases, t]
  );

  const {
    connected,
    products,
    fetchProducts,
    requestPurchase,
    getAvailablePurchases,
    availablePurchases,
  } = useIAP({
    onPurchaseSuccess: handleStorePurchaseSuccess,
    onPurchaseError: handleStorePurchaseError,
    onError: (error) => {
      setStoreError(error.message || t('common.error'));
      supabaseHelpers.logClientEvent('purchase_flow_iap_error', {
        message: error.message ?? null,
      }, 'warn');
    },
  });

  const productMap = useMemo(() => {
    return new Map<string, Product>(products.map((product) => [product.id, product]));
  }, [products]);

  const selectedPackageInfo = useMemo(() => {
    if (!selectedPackage) {
      return null;
    }
    return CREDITS.PACKAGES.find(pkg => pkg.id === selectedPackage) ?? null;
  }, [selectedPackage]);

  const selectedPriceLabel = useMemo(() => {
    if (!selectedPackageInfo) {
      return '';
    }
    const storeProduct = productMap.get(selectedPackageInfo.id);
    return storeProduct?.displayPrice ?? t('purchase.pricePrefix', { price: selectedPackageInfo.price });
  }, [productMap, selectedPackageInfo, t]);

  const purchaseCtaLabel = useMemo(() => {
    if (!selectedPackageInfo) {
      return t('purchase.buy');
    }
    return `${t('purchase.buy')} ${selectedPackageInfo.credits} ${t('purchase.creditsLabel')} · ${selectedPriceLabel}`;
  }, [selectedPackageInfo, selectedPriceLabel, t]);

  useEffect(() => {
    if (!connected) {
      return;
    }

    setStoreError(null);
    fetchProducts({ skus: productIds, type: 'in-app' }).catch((error) => {
      const message = error instanceof Error ? error.message : t('common.error');
      setStoreError(message);
    });
  }, [connected, fetchProducts, productIds, t]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    if (!connected || !isAuthenticated || !user) {
      return;
    }
    if (restoreCheckedUserRef.current !== user.id) {
      restoreCheckedUserRef.current = user.id;
      restoredTokensRef.current.clear();
    }
    getAvailablePurchases().catch((error) => {
      console.warn('[purchase] restore getAvailablePurchases failed', error);
    });
  }, [connected, getAvailablePurchases, isAuthenticated, user]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    if (!connected || !isAuthenticated || !user) {
      return;
    }
    if (!availablePurchases || availablePurchases.length === 0) {
      return;
    }

    const validIds = new Set<string>(productIds);
    const pendingPurchases = availablePurchases.filter((purchase) =>
      !!purchase.productId && validIds.has(purchase.productId)
    );

    if (pendingPurchases.length === 0) {
      return;
    }

    pendingPurchases.forEach((purchase) => {
      const token = purchase.purchaseToken ?? '';
      if (!token || restoredTokensRef.current.has(token)) {
        return;
      }
      restoredTokensRef.current.add(token);
      processPurchase(purchase, { silent: true, skipNavigation: true });
    });
  }, [availablePurchases, connected, isAuthenticated, processPurchase, productIds, user]);

  const openAuthModal = useCallback((packageId: string) => {
    setPendingAuthPackageId(packageId);
    setIsAuthModalVisible(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalVisible(false);
    setPendingAuthPackageId(null);
    setActiveProvider(null);
  }, []);

  const handleOpenLogin = useCallback(() => {
    const resumePurchaseId = pendingAuthPackageId ?? undefined;
    closeAuthModal();
    navigation.navigate(ROUTES.LOGIN, {
      redirectTo: ROUTES.PURCHASE,
      resumePurchaseId,
    });
  }, [closeAuthModal, navigation, pendingAuthPackageId]);

  const handleOpenRegister = useCallback(() => {
    const resumePurchaseId = pendingAuthPackageId ?? undefined;
    closeAuthModal();
    navigation.navigate(ROUTES.REGISTER, {
      redirectTo: ROUTES.PURCHASE,
      resumePurchaseId,
    });
  }, [closeAuthModal, navigation, pendingAuthPackageId]);

  const executePurchase = useCallback(async (packageId: string) => {
    const creditPackage = CREDITS.PACKAGES.find(pkg => pkg.id === packageId);
    if (!creditPackage) {
      Alert.alert(t('purchase.claimError'), t('purchase.invalidPackage'));
      return;
    }

    if (!connected || Platform.OS !== 'android') {
      Alert.alert(t('purchase.purchaseFailedTitle'), t('purchase.storeUnavailable'));
      return;
    }

    const storeProduct = productMap.get(packageId);
    if (!storeProduct) {
      Alert.alert(t('purchase.purchaseFailedTitle'), t('purchase.storeProductMissing'));
      return;
    }

    try {
      setPendingPurchaseId(packageId);
      supabaseHelpers.logClientEvent('purchase_flow_request', {
        productId: packageId,
        accountId: user?.id ?? null,
      });
      await requestPurchase({
        type: 'in-app',
        request: {
          google: {
            skus: [packageId],
            obfuscatedAccountId: user?.id ?? undefined,
          },
        },
      });
    } catch (error) {
      supabaseHelpers.logClientEvent('purchase_flow_request_failed', {
        productId: packageId,
        message: error instanceof Error ? error.message : String(error),
      }, 'warn');
      const purchaseError = error as PurchaseError | undefined;
      if (
        purchaseError?.code === ErrorCode.AlreadyOwned ||
        purchaseError?.code === ErrorCode.AlreadyPrepared
      ) {
        Alert.alert(t('purchase.purchasePendingTitle'), t('purchase.restoreOwnedMessage'));
        void restoreOwnedPurchases();
      } else {
        const message = error instanceof Error ? error.message : t('common.error');
        Alert.alert(t('purchase.purchaseFailedTitle'), message);
      }
      setPendingPurchaseId(null);
    }
  }, [connected, productMap, requestPurchase, restoreOwnedPurchases, t, user?.id]);

  const handleProviderLogin = useCallback(async (provider: OAuthProvider) => {
    if (!pendingAuthPackageId) {
      return;
    }
    try {
      setActiveProvider(provider);
      const result = await dispatch(signInWithProvider({ provider })).unwrap();
      if (!result.user || result.user.is_anonymous) {
        Alert.alert(t('auth.login.errorTitle'), t('common.error'));
        return;
      }
      const packageId = pendingAuthPackageId;
      Alert.alert(t('auth.login.successTitle'), t('auth.login.successMessage'), [
        {
          text: t('common.ok'),
          onPress: () => {
            closeAuthModal();
            executePurchase(packageId);
          },
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.error');
      Alert.alert(t('auth.login.errorTitle'), message);
    } finally {
      setActiveProvider(null);
    }
  }, [closeAuthModal, dispatch, executePurchase, pendingAuthPackageId, t]);

  const fetchLatestCredits = useCallback(async () => {
    if (!user?.id) {
      setLatestCredits(guestCredits ?? 0);
      return;
    }

    try {
      setIsRefreshingCredits(true);
      const creditsFromBackend = await supabaseHelpers.getUserCreditBalance(user.id);
      setLatestCredits(creditsFromBackend);
      dispatch(updateUserCredits(creditsFromBackend));
    } catch (error) {
      console.error('Failed to fetch user credits', error);
    } finally {
      setIsRefreshingCredits(false);
    }
  }, [dispatch, guestCredits, user?.id]);

  useEffect(() => {
    if (user?.credits != null) {
      setLatestCredits(user.credits);
    } else if (guestCredits != null) {
      setLatestCredits(guestCredits);
    } else {
      setLatestCredits(null);
    }
  }, [guestCredits, user?.credits, user?.id]);

  useEffect(() => {
    fetchLatestCredits();
    const unsubscribe = navigation.addListener?.('focus', fetchLatestCredits);
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [navigation, fetchLatestCredits]);

  const handlePurchase = (packageId: string) => {
    if (storeError) {
      Alert.alert(t('purchase.purchaseFailedTitle'), storeError);
      return;
    }
    if (!isAuthenticated) {
      openAuthModal(packageId);
      return;
    }
    if (!user) {
      Alert.alert(t('purchase.claimError'), t('purchase.needLogin'));
      return;
    }
    executePurchase(packageId);
  };

  const resumePurchaseId = route.params?.resumePurchaseId;

  useEffect(() => {
    if (!resumePurchaseId) {
      return;
    }
    if (resumeAttemptRef.current === resumePurchaseId) {
      return;
    }
    if (!isAuthenticated || !user || storeError || !connected || !productMap.has(resumePurchaseId)) {
      return;
    }
    resumeAttemptRef.current = resumePurchaseId;
    setSelectedPackage(resumePurchaseId);
    executePurchase(resumePurchaseId);
    navigation.setParams({ resumePurchaseId: undefined });
  }, [
    connected,
    executePurchase,
    isAuthenticated,
    navigation,
    productMap,
    resumePurchaseId,
    storeError,
    user,
  ]);

  const renderCreditPackage = (pkg: CreditPackage) => {
    const isSelected = selectedPackage === pkg.id;
    const discount = pkg.originalPrice ? Math.round((1 - pkg.price / pkg.originalPrice) * 100) : 0;
    const storeProduct = productMap.get(pkg.id);
    const priceLabel = storeProduct?.displayPrice ?? t('purchase.pricePrefix', { price: pkg.price });
    const showOriginalPrice = !storeProduct && pkg.originalPrice;
    const isDisabled = isProcessing || pendingPurchaseId !== null;

    return (
      <TouchableOpacity
        key={pkg.id}
        style={[
          styles.packageCard,
          isSelected && styles.selectedPackage,
          pkg.popular && !isSelected && styles.popularPackage,
        ]}
        onPress={() => setSelectedPackage(pkg.id)}
        activeOpacity={0.9}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected, disabled: isDisabled }}
      >
        {pkg.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>{t('purchase.popularTag')}</Text>
          </View>
        )}
        
        <View style={styles.packageHeader}>
          <Text style={styles.creditsAmount}>{pkg.credits}</Text>
          <Text style={styles.creditsLabel}>{t('purchase.creditsLabel')}</Text>
        </View>
        
        {pkg.bonus && (
          <View style={styles.bonusContainer}>
            <Text style={styles.bonusText}>{t('purchase.bonusLabel', { count: pkg.bonus })}</Text>
          </View>
        )}
        
        <View style={styles.priceContainer}>
          <Text style={styles.price}>{priceLabel}</Text>
          {showOriginalPrice && (
            <Text style={styles.originalPrice}>
              {t('purchase.originalPricePrefix', { price: pkg.originalPrice })}
            </Text>
          )}
        </View>
        
        {discount > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{t('purchase.discountLabel', { percent: discount })}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('purchase.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Credits */}
        <View style={styles.currentCreditsContainer}>
          <Text style={styles.currentCreditsLabel}>{t('purchase.currentCredits')}</Text>
          {isRefreshingCredits ? (
            <ActivityIndicator color={COLORS.PRIMARY} size="small" />
          ) : (
            <Text style={styles.currentCreditsAmount}>
              {latestCredits ?? user?.credits ?? 0}
            </Text>
          )}
        </View>

        {/* Credit Packages */}
        <View style={styles.packagesContainer}>
          <Text style={styles.sectionTitle}>{t('purchase.packagesTitle')}</Text>
          <View style={styles.packagesGrid}>
            {CREDITS.PACKAGES.map(renderCreditPackage)}
          </View>
        </View>

        {/* Usage Info */}
        <View style={styles.usageInfo}>
          <Text style={styles.usageTitle}>{t('purchase.usageTitle')}</Text>
          <View style={styles.usageItem}>
            <Ionicons name="brush" size={16} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.usageText}>
              {t('purchase.usageItems.aiEdit', { cost: CREDITS.COSTS.AI_EDIT })}
            </Text>
          </View>
        </View>
      </ScrollView>
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.purchaseCtaButton,
            (!selectedPackageInfo || isProcessing || pendingPurchaseId !== null) && styles.purchaseCtaButtonDisabled,
          ]}
          onPress={() => {
            if (selectedPackageInfo) {
              handlePurchase(selectedPackageInfo.id);
            }
          }}
          disabled={!selectedPackageInfo || isProcessing || pendingPurchaseId !== null}
          activeOpacity={0.9}
        >
          {isProcessing || pendingPurchaseId !== null ? (
            <ActivityIndicator color={COLORS.WHITE} size="small" />
          ) : (
            <Text style={styles.purchaseCtaButtonText}>{purchaseCtaLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
      <Modal
        visible={isAuthModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeAuthModal}
      >
        <View style={styles.authModalOverlay}>
          <TouchableWithoutFeedback onPress={closeAuthModal}>
            <View style={styles.authModalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.authModalCard}>
            <Text style={styles.authModalTitle}>{t('purchase.authTitle')}</Text>
            <Text style={styles.authModalSubtitle}>{t('purchase.authSubtitle')}</Text>
            <View style={styles.authModalActions}>
              <TouchableOpacity style={styles.authModalPrimaryButton} onPress={handleOpenLogin}>
                <Text style={styles.authModalPrimaryButtonText}>{t('navigation.login')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.authModalSecondaryButton} onPress={handleOpenRegister}>
                <Text style={styles.authModalSecondaryButtonText}>{t('navigation.register')}</Text>
              </TouchableOpacity>
            </View>
            <SocialLoginButtons
              onPress={handleProviderLogin}
              disabled={activeProvider !== null}
              activeProvider={activeProvider}
            />
            <TouchableOpacity style={styles.authModalCancel} onPress={closeAuthModal}>
              <Text style={styles.authModalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
    color: COLORS.TEXT_PRIMARY,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  currentCreditsContainer: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 20,
    marginVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentCreditsLabel: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
  currentCreditsAmount: {
    fontSize: 32,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    color: COLORS.PRIMARY,
  },
  packagesContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 16,
  },
  packagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  packageCard: {
    width: '48%',
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedPackage: {
    borderColor: COLORS.PRIMARY,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
    transform: [{ scale: 1.02 }],
  },
  popularPackage: {
    borderColor: COLORS.ACCENT,
  },
  popularBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    backgroundColor: COLORS.ACCENT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 8,
  },
  popularText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
    color: COLORS.WHITE,
  },
  packageHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  creditsAmount: {
    fontSize: 24,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    color: COLORS.TEXT_PRIMARY,
  },
  creditsLabel: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
  },
  bonusContainer: {
    backgroundColor: COLORS.SUCCESS_LIGHT,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'center',
    marginBottom: 8,
  },
  bonusText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
    color: COLORS.SUCCESS,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  price: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    color: COLORS.TEXT_PRIMARY,
  },
  originalPrice: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    color: COLORS.TEXT_SECONDARY,
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: COLORS.ERROR,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discountText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
    color: COLORS.WHITE,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    backgroundColor: COLORS.WHITE,
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 10,
  },
  purchaseCtaButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  purchaseCtaButtonDisabled: {
    backgroundColor: COLORS.GRAY_300,
  },
  purchaseCtaButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
    color: COLORS.WHITE,
  },
  usageInfo: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  usageTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 12,
  },
  usageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  usageText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: 8,
  },
  authModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  authModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  authModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.WHITE,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  authModalTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  authModalSubtitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
  authModalActions: {
    width: '100%',
    gap: 10,
  },
  authModalPrimaryButton: {
    width: '100%',
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  authModalPrimaryButtonText: {
    color: COLORS.WHITE,
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
  },
  authModalSecondaryButton: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
  },
  authModalSecondaryButtonText: {
    color: COLORS.PRIMARY,
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
  },
  authModalCancel: {
    paddingVertical: 6,
  },
  authModalCancelText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_TERTIARY,
  },
});

export default PurchaseScreen;
