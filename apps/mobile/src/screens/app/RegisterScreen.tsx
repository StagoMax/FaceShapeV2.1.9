import React, { useCallback, useEffect, useState } from 'react';
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
  signInWithProvider,
  signUp,
} from '../../store/slices/authSlice';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';
import type { OAuthProvider } from '../../services/supabase';

type RegisterNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

const RegisterScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<RegisterNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Register'>>();
  const { t } = useTranslation();

  const isLoading = useAppSelector(selectAuthLoading);
  const error = useAppSelector(selectAuthError);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const redirectTo = route.params?.redirectTo;
  const resumePurchaseId = route.params?.resumePurchaseId;
  const returnToPrevious = route.params?.returnToPrevious;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activeProvider, setActiveProvider] = useState<OAuthProvider | null>(null);

  const redirectAfterAuth = useCallback(() => {
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
  }, [navigation, redirectTo, resumePurchaseId, returnToPrevious]);

  useEffect(() => {
    if (isAuthenticated) {
      redirectAfterAuth();
    }
  }, [isAuthenticated, redirectAfterAuth]);

  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.headsUp'), t('auth.register.missingFields'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('common.headsUp'), t('auth.register.passwordMismatch'));
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('common.headsUp'), t('auth.register.passwordTooShort'));
      return;
    }

    try {
      const result = await dispatch(
        signUp({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        })
      ).unwrap();

      if (result.requiresEmailVerification) {
        Alert.alert(t('auth.register.successTitle'), t('auth.register.successMessage'));
        navigation.navigate(
          ROUTES.LOGIN,
          redirectTo || returnToPrevious
            ? { redirectTo, resumePurchaseId, returnToPrevious }
            : undefined
        );
      } else {
        redirectAfterAuth();
      }
    } catch (err) {
      if (err instanceof Error) {
        Alert.alert(t('auth.register.errorTitle'), err.message);
      }
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

  const goToLogin = () => {
    navigation.navigate(
      ROUTES.LOGIN,
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
            <Text style={styles.title}>{t('auth.register.title')}</Text>
            <Text style={styles.subtitle}>{t('auth.register.subtitle')}</Text>
          </View>

          <SocialLoginButtons
            onPress={handleProviderLogin}
            disabled={isLoading}
            activeProvider={activeProvider}
            labelKeyOverrides={{ google: 'auth.register.providerGoogle' }}
          />

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>{t('auth.register.divider')}</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('auth.common.displayName')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('auth.common.displayNamePlaceholder')}
              placeholderTextColor={COLORS.TEXT_TERTIARY}
              style={styles.input}
            />
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

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('auth.common.confirmPassword')}</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('auth.common.confirmPasswordPlaceholder')}
              placeholderTextColor={COLORS.TEXT_TERTIARY}
              secureTextEntry
              style={styles.input}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.WHITE} />
            ) : (
              <Text style={styles.primaryButtonText}>{t('auth.register.signUp')}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.register.footerText')}</Text>
            <TouchableOpacity onPress={goToLogin}>
              <Text style={styles.footerLink}>{t('auth.register.footerLink')}</Text>
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

export default RegisterScreen;
