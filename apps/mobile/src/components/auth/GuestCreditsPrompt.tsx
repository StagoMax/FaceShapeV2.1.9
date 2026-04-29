import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../constants';
import { useTranslation } from 'react-i18next';

type GuestCreditsPromptProps = {
  visible: boolean;
  guestCredits: number | null;
  isProcessing: boolean;
  onRequestClose: () => void;
  onPressRegister: () => void;
  onPressContinue: () => void;
};

const GuestCreditsPrompt: React.FC<GuestCreditsPromptProps> = ({
  visible,
  guestCredits,
  isProcessing,
  onRequestClose,
  onPressRegister,
  onPressContinue,
}) => {
  const continueDisabled =
    guestCredits == null || guestCredits <= 0 || isProcessing;
  const { t } = useTranslation();
  const subtitleText =
    guestCredits == null
      ? t('guestPrompt.checking')
      : t('guestPrompt.remaining', { count: guestCredits });
  const secondaryLabel =
    guestCredits == null
      ? t('guestPrompt.checkingButton')
      : t('guestPrompt.continue', { count: Math.max(guestCredits, 0) });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onRequestClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.card}>
          <Text style={styles.title}>{t('guestPrompt.title')}</Text>
          <Text style={styles.subtitle}>{subtitleText}</Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.primaryButton} onPress={onPressRegister}>
              <Text style={styles.primaryButtonText}>{t('guestPrompt.primary')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                continueDisabled && styles.secondaryButtonDisabled,
              ]}
              onPress={onPressContinue}
              disabled={continueDisabled}
            >
              {isProcessing ? (
                <ActivityIndicator color={COLORS.PRIMARY} />
              ) : (
                <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
          {guestCredits != null && guestCredits <= 0 ? (
            <Text style={styles.caption}>{t('guestPrompt.depleted')}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.WHITE,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.WHITE,
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    fontWeight: '600',
  },
  secondaryButton: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
  },
  secondaryButtonDisabled: {
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.GRAY_100,
  },
  secondaryButtonText: {
    color: COLORS.PRIMARY,
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    fontWeight: '600',
  },
  caption: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_TERTIARY,
    textAlign: 'center',
  },
});

export default GuestCreditsPrompt;
