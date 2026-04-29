import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import i18n from '../constants/i18n';

const ANON_MERGE_PAYLOAD_KEY = 'anon_merge_payload_v1';
const ANON_MERGE_PROMPTED_KEY = 'anon_merge_prompted_v1';

type AnonMergePayload = {
  anonUserId: string;
  anonAccessToken: string;
  createdAt: string;
};

const readPayload = async (): Promise<AnonMergePayload | null> => {
  const raw = await AsyncStorage.getItem(ANON_MERGE_PAYLOAD_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AnonMergePayload;
  } catch (error) {
    console.warn('[anon-merge] failed to parse payload', error);
    return null;
  }
};

const writePayload = async (payload: AnonMergePayload) => {
  await AsyncStorage.setItem(ANON_MERGE_PAYLOAD_KEY, JSON.stringify(payload));
};

const clearPayload = async () => {
  await AsyncStorage.removeItem(ANON_MERGE_PAYLOAD_KEY);
};

const hasPrompted = async () => {
  const value = await AsyncStorage.getItem(ANON_MERGE_PROMPTED_KEY);
  return value === '1';
};

const markPrompted = async () => {
  await AsyncStorage.setItem(ANON_MERGE_PROMPTED_KEY, '1');
};

export const anonMergeManager = {
  markPending: async (): Promise<AnonMergePayload | null> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('[anon-merge] getSession failed', error);
      return null;
    }
    const session = data.session;
    const user = session?.user;
    if (!session?.access_token || !user?.is_anonymous) {
      return null;
    }
    const payload: AnonMergePayload = {
      anonUserId: user.id,
      anonAccessToken: session.access_token,
      createdAt: new Date().toISOString(),
    };
    await writePayload(payload);
    return payload;
  },

  mergeIfNeeded: async () => {
    const payload = await readPayload();
    if (!payload) return null;
    const { data } = await supabase.auth.getSession();
    const currentUser = data.session?.user;
    if (!currentUser || currentUser.is_anonymous) {
      return null;
    }

    const { data: mergeData, error } = await supabase.functions.invoke('merge-anon-credits', {
      body: {
        anonAccessToken: payload.anonAccessToken,
      },
    });

    if (error) {
      throw new Error(error.message || i18n.t('errors.mergeCreditsFailed'));
    }

    await clearPayload();
    return mergeData;
  },

  hasPrompted,
  markPrompted,
};
