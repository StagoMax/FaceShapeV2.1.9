import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { AUTH_CONFIG } from '../constants';

export type AuthRedirectParams = {
  accessToken?: string;
  refreshToken?: string;
  type?: string;
  code?: string;
  rawParams: string;
};

export const parseAuthRedirectParams = (url: string): AuthRedirectParams => {
  try {
    const parsedUrl = new URL(url);
    const hash = parsedUrl.hash?.startsWith('#') ? parsedUrl.hash.slice(1) : parsedUrl.hash;
    const search = parsedUrl.search?.startsWith('?') ? parsedUrl.search.slice(1) : parsedUrl.search;
    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(search);
    const getParam = (name: string) => hashParams.get(name) ?? searchParams.get(name) ?? undefined;
    const rawParams = hashParams.toString() || searchParams.toString();

    return {
      accessToken: getParam('access_token'),
      refreshToken: getParam('refresh_token'),
      type: getParam('type'),
      code: getParam('code'),
      rawParams,
    };
  } catch {
    return { rawParams: '' };
  }
};

export const buildAppCallbackUrl = (rawParams?: string) => {
  const resolveScheme = () => {
    if (Platform.OS !== 'android') {
      return AUTH_CONFIG.APP_SCHEME;
    }
    const appId = Application.applicationId;
    if (appId && appId.endsWith('.debug')) {
      return `${AUTH_CONFIG.APP_SCHEME}-debug`;
    }
    return AUTH_CONFIG.APP_SCHEME;
  };
  const baseUrl = `${resolveScheme()}://${AUTH_CONFIG.APP_CALLBACK_PATH}`;
  if (!rawParams) {
    return baseUrl;
  }
  return `${baseUrl}#${rawParams}`;
};
