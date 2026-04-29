import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabaseHelpers } from '../services/supabase';
import type { GuestDevice } from '../types';
import { getDeviceFingerprint } from './deviceIdentifier';

const FALLBACK_CREDITS_KEY = 'guest_credits_fallback';
const GUEST_DEVICE_CACHE_KEY = 'guest_device_cache_v1';
export const DEFAULT_GUEST_CREDITS = 0;

type CachedDevice = Pick<GuestDevice, 'fingerprint' | 'free_uses_remaining' | 'total_used' | 'blocked' | 'updated_at'>;

let inMemoryDevice: CachedDevice | null = null;
let cachedFingerprint: string | null = null;

const toCachedDevice = (record: GuestDevice): CachedDevice => ({
  fingerprint: record.fingerprint,
  free_uses_remaining: record.free_uses_remaining,
  total_used: record.total_used,
  blocked: record.blocked,
  updated_at: record.updated_at,
});

const persistCache = async (record: CachedDevice | null) => {
  if (!record) {
    await AsyncStorage.removeItem(GUEST_DEVICE_CACHE_KEY);
    return;
  }
  await AsyncStorage.setItem(GUEST_DEVICE_CACHE_KEY, JSON.stringify(record));
};

const readCache = async (): Promise<CachedDevice | null> => {
  if (inMemoryDevice) {
    return inMemoryDevice;
  }
  const raw = await AsyncStorage.getItem(GUEST_DEVICE_CACHE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as CachedDevice;
    inMemoryDevice = parsed;
    return parsed;
  } catch (error) {
    console.warn('Failed to parse guest device cache', error);
    return null;
  }
};

const setFallbackCredits = async (credits: number) => {
  await AsyncStorage.setItem(FALLBACK_CREDITS_KEY, credits.toString());
};

const getFallbackCredits = async (): Promise<number> => {
  const stored = await AsyncStorage.getItem(FALLBACK_CREDITS_KEY);
  if (!stored) {
    return DEFAULT_GUEST_CREDITS;
  }
  const parsed = parseInt(stored, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_GUEST_CREDITS;
};

const getFingerprint = async () => {
  if (cachedFingerprint) {
    return cachedFingerprint;
  }
  cachedFingerprint = await getDeviceFingerprint();
  return cachedFingerprint;
};

const ensureRemoteDevice = async (): Promise<CachedDevice> => {
  const fingerprint = await getFingerprint();

  try {
    const existing = await supabaseHelpers.getGuestDevice(fingerprint);
    if (existing) {
      const simplified = toCachedDevice(existing);
      inMemoryDevice = simplified;
      await persistCache(simplified);
      await setFallbackCredits(existing.free_uses_remaining);
      return simplified;
    }

    const created = await supabaseHelpers.upsertGuestDevice(fingerprint, {
      free_uses_remaining: DEFAULT_GUEST_CREDITS,
      total_used: 0,
      blocked: false,
    });
    const simplified = toCachedDevice(created);
    inMemoryDevice = simplified;
    await persistCache(simplified);
    await setFallbackCredits(created.free_uses_remaining);
    return simplified;
  } catch (error) {
    console.warn('Failed to sync guest device with Supabase', error);
    const cached = await readCache();
    if (cached) {
      return cached;
    }
    const fallbackCredits = await getFallbackCredits();
    const fallback: CachedDevice = {
      fingerprint,
      free_uses_remaining: fallbackCredits,
      total_used: 0,
      blocked: false,
      updated_at: new Date().toISOString(),
    };
    inMemoryDevice = fallback;
    await persistCache(fallback);
    return fallback;
  }
};

const updateRemoteDevice = async (updates: Partial<GuestDevice>) => {
  const fingerprint = await getFingerprint();
  try {
    const updated = await supabaseHelpers.updateGuestDevice(fingerprint, updates);
    const simplified = toCachedDevice(updated);
    inMemoryDevice = simplified;
    await persistCache(simplified);
    await setFallbackCredits(updated.free_uses_remaining);
    return simplified;
  } catch (error: any) {
    console.warn('Failed to update guest device remotely', error);
    if (error?.code === 'PGRST116') {
      try {
        const upserted = await supabaseHelpers.upsertGuestDevice(fingerprint, updates);
        const simplified = toCachedDevice(upserted);
        inMemoryDevice = simplified;
        await persistCache(simplified);
        await setFallbackCredits(upserted.free_uses_remaining);
        return simplified;
      } catch (innerError) {
        console.warn('Failed to upsert guest device after update failure', innerError);
      }
    }
    throw error;
  }
};

const ensureDevice = async () => {
  const device = await ensureRemoteDevice();
  if (device.blocked) {
    throw new Error('Free uses for this device have been locked. Please sign up to continue.');
  }
  return device;
};

export const guestCreditsManager = {
  loadCredits: async (): Promise<number> => {
    return 0;
  },

  setCredits: async (_credits: number): Promise<number> => {
    return 0;
  },

  decrementCredits: async (_amount: number = 1): Promise<number> => {
    return 0;
  },

  resetCredits: async (): Promise<number> => {
    return 0;
  },

  getFingerprint,
};
