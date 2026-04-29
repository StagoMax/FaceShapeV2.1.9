import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';
// 在 Expo 环境下优先使用 expo-localization，避免 Expo Go/未重建 Dev Client 时出现
// `RNLocalize could not be found` 的原生模块缺失报错。
import * as Localization from 'expo-localization';

import en from './locales/en';
import ja from './locales/ja';
import zh from './locales/zh';
import zhTW from './locales/zh-TW';

export const LANGUAGE_PREFERENCE_KEY = '@faceshape_language';

const resources = {
  zh: { translation: zh },
  'zh-TW': { translation: zhTW },
  en: { translation: en },
  ja: { translation: ja },
} as const;

export type LanguageCode = keyof typeof resources;

export const SUPPORTED_LANGUAGES: LanguageCode[] = Object.keys(resources) as LanguageCode[];

const FALLBACK_LANGUAGE: LanguageCode = 'en';

const SUPPORTED_LANGUAGE_MAP = Object.keys(resources).reduce((acc, key) => {
  acc[key.toLowerCase()] = key as LanguageCode;
  return acc;
}, {} as Record<string, LanguageCode>);

const LANGUAGE_ALIASES: Record<string, LanguageCode> = {
  zh: 'zh',
  'zh-cn': 'zh',
  'zh-hans': 'zh',
  'zh-sg': 'zh',
  'zh-hans-cn': 'zh',
  'zh-hans-sg': 'zh',
  'zh-tw': 'zh-TW',
  'zh-hk': 'zh-TW',
  'zh-mo': 'zh-TW',
  'zh-hant': 'zh-TW',
  'zh-hant-tw': 'zh-TW',
  'zh-hant-hk': 'zh-TW',
  'zh-hant-mo': 'zh-TW',
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  ja: 'ja',
  'ja-jp': 'ja',
};

export const normalizeLanguageCode = (value?: string | null): LanguageCode | null => {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/_/g, '-').toLowerCase();
  return LANGUAGE_ALIASES[normalized] ?? SUPPORTED_LANGUAGE_MAP[normalized] ?? null;
};

const resolveDeviceLanguage = (): LanguageCode => {
  try {
    const locales = typeof Localization.getLocales === 'function' ? Localization.getLocales() : [];
    for (const locale of locales) {
      const tag = (locale as { languageTag?: string }).languageTag;
      const code = (locale as { languageCode?: string }).languageCode;
      const candidate = normalizeLanguageCode(tag) ?? normalizeLanguageCode(code);
      if (candidate) {
        return candidate;
      }
    }
  } catch {
    // 当本地没有内置模块（旧 Dev Client / 非 Expo Go）时，避免崩溃并回退到默认语言
  }
  return FALLBACK_LANGUAGE;
};

export const initializeI18n = async () => {
  if (i18n.isInitialized) {
    return i18n;
  }

  let initialLanguage: LanguageCode = FALLBACK_LANGUAGE;

  if (Platform.OS === 'web') {
    initialLanguage = FALLBACK_LANGUAGE;
  } else {
    try {
      const storedLanguage = await AsyncStorage.getItem(LANGUAGE_PREFERENCE_KEY);
      const normalizedLanguage = normalizeLanguageCode(storedLanguage);
      if (normalizedLanguage) {
        initialLanguage = normalizedLanguage;
      } else {
        initialLanguage = resolveDeviceLanguage();
      }
    } catch {
      initialLanguage = resolveDeviceLanguage();
    }
  }

  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: initialLanguage,
      fallbackLng: FALLBACK_LANGUAGE,
      compatibilityJSON: 'v4',
      interpolation: {
        escapeValue: false,
      },
      returnNull: false,
    });

  return i18n;
};

export const setAppLanguage = async (language: LanguageCode) => {
  if (Platform.OS === 'web' && language !== FALLBACK_LANGUAGE) {
    await i18n.changeLanguage(FALLBACK_LANGUAGE);
    await AsyncStorage.setItem(LANGUAGE_PREFERENCE_KEY, FALLBACK_LANGUAGE);
    return;
  }

  if (i18n.language === language) {
    await AsyncStorage.setItem(LANGUAGE_PREFERENCE_KEY, language);
    return;
  }

  await i18n.changeLanguage(language);
  await AsyncStorage.setItem(LANGUAGE_PREFERENCE_KEY, language);
};

export const getCurrentLanguage = () => normalizeLanguageCode(i18n.language) ?? FALLBACK_LANGUAGE;

export default i18n;
