import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../../services/supabase';
import { COLORS, ROUTES, TYPOGRAPHY } from '../../constants';
import type { RootStackParamList } from '../../types';
import { parseAuthRedirectParams } from '../../utils/authRedirect';

type Status = 'loading' | 'success' | 'error';

type AuthCallbackNavigationProp = StackNavigationProp<RootStackParamList>;

const AuthCallbackScreen: React.FC = () => {
  const navigation = useNavigation<AuthCallbackNavigationProp>();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Finishing sign-in...');
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    let isActive = true;

    const handleUrl = async (url: string | null) => {
      if (hasCompletedRef.current) {
        return;
      }
      if (!url) {
        setStatus('error');
        setMessage('Missing sign-in data. Please open the app and log in again.');
        return;
      }

      setStatus('loading');
      try {
        const { accessToken, refreshToken, code } = parseAuthRedirectParams(url);
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
          throw new Error('Missing token data.');
        }

        if (!isActive) return;
        hasCompletedRef.current = true;
        setStatus('success');
        setMessage('Signed in. Redirecting...');
        navigation.reset({
          index: 0,
          routes: [{ name: ROUTES.HOME }],
        });
      } catch (error) {
        if (!isActive) return;
        console.warn('Auth callback failed', error);
        setStatus('error');
        setMessage('Unable to finish sign-in. Please open the app and log in again.');
      }
    };

    Linking.getInitialURL().then((url) => {
      if (isActive) {
        handleUrl(url);
      }
    });

    const subscription = Linking.addEventListener('url', (event) => {
      if (isActive) {
        handleUrl(event.url);
      }
    });

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Signing you in</Text>
        <Text style={styles.subtitle}>{message}</Text>
        {status === 'loading' && (
          <ActivityIndicator size="small" color={COLORS.PRIMARY} style={styles.loader} />
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
});

export default AuthCallbackScreen;
