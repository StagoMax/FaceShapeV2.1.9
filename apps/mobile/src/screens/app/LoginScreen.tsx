import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { COLORS, ROUTES, TYPOGRAPHY } from '../../constants';
import type { RootStackParamList } from '../../types';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  clearError,
  selectAuthError,
  selectAuthLoading,
  selectIsAuthenticated,
  signIn,
  signInWithProvider,
} from '../../store/slices/authSlice';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';
import { supabase, type OAuthProvider } from '../../services/supabase';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Login'>>();
  const { t } = useTranslation();

  const isLoading = useAppSelector(selectAuthLoading);
  const error = useAppSelector(selectAuthError);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const redirectTo = route.params?.redirectTo;
  const resumePurchaseId = route.params?.resumePurchaseId;
  const returnToPrevious = route.params?.returnToPrevious;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeProvider, setActiveProvider] = useState<OAuthProvider | null>(null);

  useEffect(() => {
    let isActive = true;
    const maybeRedirect = async () => {
      if (!isAuthenticated) {
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!isActive || !data.session?.access_token) {
        return;
      }
      if (returnToPrevious) {
        if (navigation.canGoBack()) {
          navigation.goBack();
          return;
        }
      }
      if (redirectTo) {
        if (redirectTo === ROUTES.PURCHASE) {
          navigation.navigate(
            ROUTES.PURCHASE,
            resumePurchaseId ? { resumePurchaseId } : undefined
          );
          return;
        }
        navigation.navigate(redirectTo);
        return;
      }
      navigation.reset({
        index: 0,
        routes: [{ name: ROUTES.HOME }],
      });
    };
    void maybeRedirect();
    return () => {
      isActive = false;
    };
  }, [isAuthenticated, navigation, redirectTo, resumePurchaseId, returnToPrevious]);

  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.headsUp'), t('auth.login.missingFields'));
      return;
    }

    try {
      await dispatch(signIn({ email: email.trim(), password })).unwrap();
    } catch {
      // 错误信息通过全局状态展示
    }
  };

  const handleProviderLogin = async (provider: OAuthProvider) => {
    try {
      setActiveProvider(provider);
      await dispatch(signInWithProvider({ provider })).unwrap();
      Alert.alert(t('auth.login.successTitle'), t('auth.login.successMessage'));
    } catch (err) {
      if (err instanceof Error) {
        Alert.alert(t('auth.login.errorTitle'), err.message);
      }
    } finally {
      setActiveProvider(null);
    }
  };

  const goToRegister = () => {
    navigation.navigate(
      ROUTES.REGISTER,
      redirectTo || returnToPrevious
        ? { redirectTo, resumePurchaseId, returnToPrevious }
        : undefined
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>{t('auth.login.title')}</Text>
            <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('auth.common.email')}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.common.emailPlaceholder')}
              placeholderTextColor={COLORS.TEXT_TERTIARY}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('auth.common.password')}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.common.passwordPlaceholder')}
              placeholderTextColor={COLORS.TEXT_TERTIARY}
              secureTextEntry
              style={styles.input}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.WHITE} />
            ) : (
              <Text style={styles.primaryButtonText}>{t('auth.login.signIn')}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>{t('auth.login.divider')}</Text>
            <View style={styles.divider} />
          </View>

          <SocialLoginButtons
            onPress={handleProviderLogin}
            disabled={isLoading}
            activeProvider={activeProvider}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.login.footerText')}</Text>
            <TouchableOpacity onPress={goToRegister}>
              <Text style={styles.footerLink}>{t('auth.login.footerLink')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  flex: {
    flex: 1,
  },
  container: {
    padding: 24,
    flexGrow: 1,
    justifyContent: 'center',
    gap: 20,
  },
  header: {
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    color: COLORS.TEXT_SECONDARY,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.WHITE,
    color: COLORS.TEXT_PRIMARY,
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
  },
  primaryButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: COLORS.WHITE,
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.BORDER,
  },
  dividerText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_TERTIARY,
  },
  errorText: {
    color: COLORS.ERROR,
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  footerText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
  },
  footerLink: {
    color: COLORS.PRIMARY,
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: '600',
  },
});

export default LoginScreen;
