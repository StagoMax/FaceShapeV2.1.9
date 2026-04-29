import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const SECURE_STORE_KEY = 'fs_device_fingerprint';
let cachedFingerprint: string | null = null;

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const digestString = async (input: string) => {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input
  );
  return digest.toLowerCase();
};

const buildRawFingerprint = async () => {
  let androidId: string | null = null;
  if (Platform.OS === 'android') {
    try {
      androidId = Application.getAndroidId();
    } catch (error) {
      console.warn('Unable to read Android ID', error);
    }
  }

  const iosVendorId = Platform.OS === 'ios'
    ? await Application.getIosIdForVendorAsync()
    : null;

  const parts = [
    Platform.OS,
    Application.applicationId ?? 'unknownApp',
    androidId ?? '',
    iosVendorId ?? '',
    Device.brand ?? '',
    Device.modelName ?? '',
    Device.osVersion ?? '',
    Device.osBuildId ?? '',
  ];

  return parts.filter(Boolean).join('|');
};

const createFallbackFingerprint = async () => {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  const randomHex = toHex(randomBytes);
  const timestamp = Date.now().toString();
  return digestString(`${randomHex}|${timestamp}`);
};

const createFingerprint = async () => {
  try {
    const raw = await buildRawFingerprint();
    if (raw) {
      return await digestString(raw);
    }
  } catch (error) {
    console.warn('Failed to build raw device fingerprint', error);
  }
  return createFallbackFingerprint();
};

export const getDeviceFingerprint = async (): Promise<string> => {
  if (cachedFingerprint) {
    return cachedFingerprint;
  }

  try {
    const stored = await SecureStore.getItemAsync(SECURE_STORE_KEY);
    if (stored) {
      cachedFingerprint = stored;
      return stored;
    }
  } catch (error) {
    console.warn('Failed to read fingerprint from secure storage', error);
  }

  const fingerprint = await createFingerprint();

  try {
    await SecureStore.setItemAsync(SECURE_STORE_KEY, fingerprint);
  } catch (error) {
    console.warn('Failed to persist fingerprint', error);
  }

  cachedFingerprint = fingerprint;
  return fingerprint;
};

export const clearCachedFingerprint = () => {
  cachedFingerprint = null;
};
