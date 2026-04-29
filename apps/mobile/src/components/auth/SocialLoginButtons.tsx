import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY } from '../../constants';
import type { OAuthProvider } from '../../services/supabase';
import { useTranslation } from 'react-i18next';

type ProviderLabelKey = 'auth.login.providerGoogle' | 'auth.register.providerGoogle';

const PROVIDERS: Array<{
  id: OAuthProvider;
  labelKey: ProviderLabelKey;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'google', icon: 'logo-google', labelKey: 'auth.login.providerGoogle' },
];

type SocialLoginButtonsProps = {
  onPress: (provider: OAuthProvider) => void;
  disabled?: boolean;
  activeProvider?: OAuthProvider | null;
  labelKeyOverrides?: Partial<Record<OAuthProvider, ProviderLabelKey>>;
};

const SocialLoginButtons: React.FC<SocialLoginButtonsProps> = ({
  onPress,
  disabled = false,
  activeProvider = null,
  labelKeyOverrides,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {PROVIDERS.map((provider) => {
        const isActive = activeProvider === provider.id;
        const labelKey = labelKeyOverrides?.[provider.id] ?? provider.labelKey;
        const label = t(labelKey);
        return (
          <TouchableOpacity
            key={provider.id}
            style={[styles.button, isActive && styles.buttonActive]}
            onPress={() => onPress(provider.id)}
            disabled={disabled || isActive}
            accessibilityLabel={label}
          >
            {isActive ? (
              <ActivityIndicator color={COLORS.WHITE} />
            ) : (
              <>
                <Ionicons
                  name={provider.icon}
                  size={20}
                  color={COLORS.TEXT_PRIMARY}
                  style={styles.icon}
                />
                <Text style={styles.label}>{label}</Text>
              </>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  buttonActive: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  icon: {
    marginRight: 8,
  },
  label: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    fontWeight: '600',
  },
});

export default SocialLoginButtons;
