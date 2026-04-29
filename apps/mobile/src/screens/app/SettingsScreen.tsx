import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, ROUTES, TYPOGRAPHY } from '../../constants';
import type { RootStackParamList } from '../../types';
import { useAppSelector, useAppDispatch } from '../../store';
import { selectIsAuthenticated, selectUser, signOut } from '../../store/slices/authSlice';
import {
  SUPPORTED_LANGUAGES,
  type LanguageCode,
  normalizeLanguageCode,
  setAppLanguage,
} from '../../constants/i18n';

const SettingsScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const normalizedLanguage = normalizeLanguageCode(i18n.language) ?? 'zh';
  const [languageChanging, setLanguageChanging] = useState<LanguageCode | null>(null);
  const [isLanguageExpanded, setIsLanguageExpanded] = useState(false);
  const languageOptions = useMemo(
    () =>
      SUPPORTED_LANGUAGES.map((code) => ({
        code,
        label: t(`languages.${code}`),
      })),
    [t, i18n.language]
  );

  const handleLanguageChange = async (code: LanguageCode) => {
    if (code === normalizedLanguage) {
      return;
    }
    setLanguageChanging(code);
    try {
      await setAppLanguage(code);
    } finally {
      setLanguageChanging(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await dispatch(signOut()).unwrap();
    } catch (error) {
      console.warn('sign out failed', error);
    }
  };

  const handleOpenLogin = () => {
    navigation.navigate(ROUTES.LOGIN);
  };

  const handleOpenRegister = () => {
    navigation.navigate(ROUTES.REGISTER);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('settings.accountSectionTitle')}</Text>
          </View>
          {isAuthenticated && user ? (
            <>
              <Text style={styles.sectionDescription}>
                {t('settings.signedInAs', { email: user.email })}
              </Text>
              <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <Text style={styles.signOutButtonText}>{t('settings.signOut')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.sectionDescription}>{t('home.header.guestDescription')}</Text>
              <View style={styles.authActions}>
                <TouchableOpacity style={styles.authPrimaryButton} onPress={handleOpenLogin}>
                  <Text style={styles.authPrimaryButtonText}>{t('navigation.login')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.authSecondaryButton} onPress={handleOpenRegister}>
                  <Text style={styles.authSecondaryButtonText}>{t('navigation.register')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.languageHeader}
            onPress={() => setIsLanguageExpanded((prev) => !prev)}
          >
            <View style={styles.languageTexts}>
              <Text style={styles.sectionTitle}>{t('settings.languageSectionTitle')}</Text>
              <Text style={styles.sectionDescription}>{t('settings.languageSectionSubtitle')}</Text>
            </View>
            <View style={styles.languageStatus}>
              <Text style={styles.languageStatusText}>
                {t('settings.currentLanguage', { language: t(`languages.${normalizedLanguage}`) })}
              </Text>
              <Ionicons
                name={isLanguageExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={COLORS.TEXT_SECONDARY}
              />
            </View>
          </TouchableOpacity>
          {isLanguageExpanded && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.languageScrollContent}
            >
              {languageOptions.map(({ code, label }) => {
                const isActive = normalizedLanguage === code;
                const isPending = languageChanging === code;
                return (
                  <TouchableOpacity
                    key={code}
                    style={[
                      styles.languagePill,
                      (isActive || isPending) && styles.languagePillActive,
                    ]}
                    onPress={() => handleLanguageChange(code)}
                    disabled={languageChanging !== null && languageChanging !== code}
                  >
                    {isPending ? (
                      <ActivityIndicator size="small" color={COLORS.WHITE} />
                    ) : (
                      <Text
                        style={[
                          styles.languagePillText,
                          (isActive || isPending) && styles.languagePillTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.policySectionTitle')}</Text>
          <Text style={styles.sectionDescription}>{t('settings.policySectionSubtitle')}</Text>
          <View style={styles.list}>
            <TouchableOpacity
              style={styles.listItem}
              onPress={() => navigation.navigate(ROUTES.PRIVACY_POLICY)}
            >
              <Text style={styles.listItemText}>{t('settings.privacyPolicy')}</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.TEXT_SECONDARY} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.listItem}
              onPress={() => navigation.navigate(ROUTES.TERMS_OF_SERVICE)}
            >
              <Text style={styles.listItemText}>{t('settings.termsOfService')}</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.TEXT_SECONDARY} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  section: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    shadowColor: COLORS.BLACK,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
    color: COLORS.TEXT_PRIMARY,
  },
  badge: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.PRIMARY,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  sectionDescription: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
  languageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  languageTexts: {
    flex: 1,
    gap: 6,
  },
  languageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  languageStatusText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
  },
  languageScrollContent: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  languagePill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.WHITE,
  },
  languagePillActive: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: COLORS.PRIMARY,
  },
  languagePillText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
  },
  languagePillTextActive: {
    color: COLORS.WHITE,
  },
  signOutButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.ERROR,
  },
  signOutButtonText: {
    color: COLORS.ERROR,
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
  },
  authActions: {
    gap: 10,
    marginTop: 6,
  },
  authPrimaryButton: {
    width: '100%',
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  authPrimaryButtonText: {
    color: COLORS.WHITE,
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
  },
  authSecondaryButton: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
  },
  authSecondaryButtonText: {
    color: COLORS.PRIMARY,
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
  },
  list: {
    marginTop: 4,
    gap: 10,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.BACKGROUND,
  },
  listItemText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
  },
});

export default SettingsScreen;
