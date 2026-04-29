import React, { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store, useAppDispatch } from './src/store';
import { COLORS, ROUTES } from './src/constants';
import { initializeI18n } from './src/constants/i18n';
import type { RootStackParamList } from './src/types';
import * as AppScreens from './src/screens/app';
import { getCurrentUser, loadGuestCredits } from './src/store/slices/authSlice';
import { useTranslation } from 'react-i18next';
import { supabase, supabaseHelpers } from './src/services/supabase';
import PurchaseRestoreHandler from './src/components/purchase/PurchaseRestoreHandler';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const linking = useMemo(() => {
    const screensConfig = {
      [ROUTES.HOME]: '',
      [ROUTES.LOGIN]: 'login',
      [ROUTES.REGISTER]: 'register',
      [ROUTES.EDITOR]: 'editor',
      [ROUTES.PURCHASE]: 'purchase',
      [ROUTES.SETTINGS]: 'settings',
      [ROUTES.PRIVACY_POLICY]: 'privacy',
      [ROUTES.TERMS_OF_SERVICE]: 'terms',
      [ROUTES.AUTH_CALLBACK]: 'auth/callback',
    };

    return {
      prefixes: ['miri://'],
      config: {
        screens: screensConfig,
      },
    };
  }, []);

  useEffect(() => {
    dispatch(getCurrentUser());
    dispatch(loadGuestCredits());
  }, [dispatch]);

  useEffect(() => {
    const logSession = async (source: string) => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          if (__DEV__) {
            console.warn('[auth][session]', source, 'error', error.message);
          }
          await supabaseHelpers.logClientEvent('auth_session_error', {
            source,
            message: error.message,
          }, 'warn');
          return;
        }

        const session = data.session;
        const payload = {
          source,
          hasSession: Boolean(session),
          hasAccessToken: Boolean(session?.access_token),
          userId: session?.user?.id ?? null,
          expiresAt: session?.expires_at ?? null,
        };

        if (__DEV__) {
          console.log('[auth][session]', source, payload);
        }

        await supabaseHelpers.logClientEvent('auth_session', payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (__DEV__) {
          console.warn('[auth][session]', source, 'exception', message);
        }
        await supabaseHelpers.logClientEvent('auth_session_exception', {
          source,
          message,
        }, 'error');
      }
    };

    const clientInfo = supabaseHelpers.getSupabaseClientInfo();
    if (__DEV__) {
      console.log('[supabase][config]', clientInfo);
    }
    supabaseHelpers.logClientEvent('supabase_config', clientInfo);

    logSession('startup');
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      logSession(event);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName={ROUTES.HOME}
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.PRIMARY,
          },
          headerTintColor: COLORS.WHITE,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name={ROUTES.HOME} 
          component={AppScreens.HomeScreen} 
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name={ROUTES.EDITOR} 
          component={AppScreens.EditorScreen} 
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name={ROUTES.LOGIN} 
          component={AppScreens.LoginScreen} 
          options={{
            title: t('navigation.login'),
            headerStyle: { backgroundColor: COLORS.WHITE },
            headerTintColor: COLORS.TEXT_PRIMARY,
          }}
        />
        <Stack.Screen 
          name={ROUTES.REGISTER} 
          component={AppScreens.RegisterScreen} 
          options={{
            title: t('navigation.register'),
            headerStyle: { backgroundColor: COLORS.WHITE },
            headerTintColor: COLORS.TEXT_PRIMARY,
          }}
        />
        <Stack.Screen 
          name={ROUTES.PURCHASE} 
          component={AppScreens.PurchaseScreen} 
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name={ROUTES.SETTINGS} 
          component={AppScreens.SettingsScreen} 
          options={{
            title: t('navigation.settings'),
            headerStyle: { backgroundColor: COLORS.WHITE },
            headerTintColor: COLORS.TEXT_PRIMARY,
          }}
        />
        <Stack.Screen
          name={ROUTES.PRIVACY_POLICY}
          component={AppScreens.PrivacyPolicyScreen}
          options={{
            title: t('navigation.privacyPolicy'),
            headerStyle: { backgroundColor: COLORS.WHITE },
            headerTintColor: COLORS.TEXT_PRIMARY,
          }}
        />
        <Stack.Screen
          name={ROUTES.TERMS_OF_SERVICE}
          component={AppScreens.TermsOfServiceScreen}
          options={{
            title: t('navigation.termsOfService'),
            headerStyle: { backgroundColor: COLORS.WHITE },
            headerTintColor: COLORS.TEXT_PRIMARY,
          }}
        />
        <Stack.Screen
          name={ROUTES.AUTH_CALLBACK}
          component={AppScreens.AuthCallbackScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [isI18nReady, setIsI18nReady] = useState(false);

  // 已移除本地 FaceMesh 模型预加载

  useEffect(() => {
    initializeI18n()
      .then(() => setIsI18nReady(true))
      .catch((error: unknown) => {
        console.warn('Failed to initialize i18n', error);
        setIsI18nReady(true);
      });
  }, []);

  if (!isI18nReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Provider store={store}>
          <View style={styles.container}>
            <StatusBar style="light" />
            <PurchaseRestoreHandler />
            <AppNavigator />
          </View>
        </Provider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
});
