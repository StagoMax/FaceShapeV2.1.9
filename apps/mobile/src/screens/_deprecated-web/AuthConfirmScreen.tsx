import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../services/supabase';
import { COLORS, TYPOGRAPHY } from '../../constants';
import { buildAppCallbackUrl, parseAuthRedirectParams } from '../../utils/authRedirect';

type Status = 'loading' | 'success' | 'error';

const AuthConfirmScreen: React.FC = () => {
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Verifying your email...');
  const [deepLink, setDeepLink] = useState<string | null>(null);

  useEffect(() => {
    const confirmEmail = async () => {
      if (typeof window === 'undefined' || !window.location?.href) {
        setStatus('error');
        setMessage('Unable to read the verification link.');
        return;
      }

      const { accessToken, refreshToken, code, rawParams } = parseAuthRedirectParams(window.location.href);

      try {
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          throw new Error('Missing confirmation parameters.');
        }

        setStatus('success');
        setMessage('Email verified. You can open the app or continue on the web.');
        setDeepLink(buildAppCallbackUrl(rawParams));
      } catch (error) {
        console.warn('Email confirmation failed', error);
        setStatus('error');
        setMessage('Verification failed. Please request a new confirmation email.');
      }
    };

    confirmEmail();
  }, []);

  const handleOpenApp = async () => {
    if (!deepLink) {
      return;
    }
    try {
      await Linking.openURL(deepLink);
    } catch (error) {
      console.warn('Failed to open app', error);
      setMessage('Unable to open the app. Please open it manually.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Email confirmation</Text>
        <Text style={styles.subtitle}>{message}</Text>
        {status === 'loading' && (
          <ActivityIndicator size="small" color={COLORS.PRIMARY} style={styles.loader} />
        )}
        {status === 'success' && deepLink && (
          <TouchableOpacity style={styles.primaryButton} onPress={handleOpenApp}>
            <Text style={styles.primaryButtonText}>Open the app</Text>
          </TouchableOpacity>
        )}
        {status === 'error' && (
          <Text style={styles.helper}>If the link is expired, request a new email and try again.</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.WHITE,
    borderRadius: 20,
    padding: 24,
    gap: 16,
    shadowColor: COLORS.BLACK,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XL,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    color: COLORS.TEXT_PRIMARY,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 22,
  },
  loader: {
    alignSelf: 'flex-start',
  },
  primaryButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.WHITE,
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
  },
  helper: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_TERTIARY,
  },
});

export default AuthConfirmScreen;
