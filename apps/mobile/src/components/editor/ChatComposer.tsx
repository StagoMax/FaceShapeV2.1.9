import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../constants';

type ChatComposerProps = {
  prompt: string;
  onChangePrompt: (value: string) => void;
  onSend: () => void;
  isSending?: boolean;
  isInputFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onKeyboardHeightChange?: (height: number) => void;
};

const ChatComposer: React.FC<ChatComposerProps> = ({
  prompt: _prompt,
  onChangePrompt: _onChangePrompt,
  onSend,
  isSending = false,
  isInputFocused: _isInputFocused,
  onFocus: _onFocus,
  onBlur: _onBlur,
  onKeyboardHeightChange,
}) => {
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.container,
      ]}
      onLayout={(event) => {
        onKeyboardHeightChange?.(event.nativeEvent.layout.height);
      }}
    >
      <TouchableOpacity
        style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
        onPress={onSend}
        disabled={isSending}
      >
        <View style={styles.sendContent}>
          <Text style={styles.sendText}>{t('editor.generateCta')}</Text>
          <Text style={styles.sendIcon}>{isSending ? '…' : '➤'}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: COLORS.WHITE,
  },
  sendButton: {
    backgroundColor: '#383838',
    borderRadius: 12,
    height: 52,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  sendContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  sendIcon: {
    color: COLORS.WHITE,
    fontSize: 18,
    fontWeight: 'bold',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
});

export default memo(ChatComposer);
