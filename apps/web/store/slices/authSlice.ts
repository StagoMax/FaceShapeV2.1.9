'use client';

import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PostgrestError, User as SupabaseUser } from '@supabase/supabase-js';
import type { UserProfile } from '@miriai/types';
import { translateClientMessage } from '@/lib/i18n/runtime';
import { supabase } from '@/lib/supabase';

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

type SignUpStatus = 'signed_in' | 'email_already_registered';

interface SignUpResult {
  status: SignUpStatus;
  user: UserProfile | null;
}

const initialState: AuthState = {
  user: null,
  loading: true,
  error: null,
};

const isProfileNotFound = (error: unknown) => {
  const pgError = error as PostgrestError | undefined;
  return pgError?.code === 'PGRST116';
};

const isMissingSessionError = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  return /auth session missing|session missing|refresh token.*(missing|not found)|invalid refresh token/i.test(
    message
  );
};

const isMissingSessionMessage = (message: string | null | undefined) =>
  Boolean(
    message &&
      /auth session missing|session missing|refresh token.*(missing|not found)|invalid refresh token/i.test(
        message
      )
  );

const isDuplicateEmailErrorMessage = (message: string) =>
  /already (?:been )?registered|already exists|user already exists/i.test(message);

const mapUser = (authUser: SupabaseUser, profile?: Partial<UserProfile> | null): UserProfile => ({
  id: authUser.id,
  email: authUser.email ?? '',
  name: profile?.name ?? (authUser.user_metadata?.name as string | undefined) ?? null,
  avatar_url: profile?.avatar_url ?? (authUser.user_metadata?.avatar_url as string | undefined) ?? null,
  is_anonymous: authUser.is_anonymous ?? false,
  credits: profile?.credits ?? 0,
  free_uses_remaining: profile?.free_uses_remaining ?? 0,
  ai_consent_at: profile?.ai_consent_at ?? null,
  privacy_policy_version: profile?.privacy_policy_version ?? null,
  terms_of_service_version: profile?.terms_of_service_version ?? null,
  created_at: profile?.created_at ?? authUser.created_at,
  updated_at: profile?.updated_at ?? authUser.updated_at ?? authUser.created_at,
});

const ensureProfile = async (authUser: SupabaseUser): Promise<Partial<UserProfile> | null> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    if (!isProfileNotFound(error)) {
      throw error;
    }

    const payload = {
      id: authUser.id,
      name: authUser.user_metadata?.name ?? null,
      avatar_url: authUser.user_metadata?.avatar_url ?? null,
    };

    const { data, error: upsertError } = await supabase
      .from('user_profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (upsertError) {
      throw upsertError;
    }
    return data;
  }
};

export const fetchCurrentUser = createAsyncThunk<UserProfile | null, void, { rejectValue: string }>(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        throw error;
      }
      if (!data.user) {
        return null;
      }
      const profile = await ensureProfile(data.user);
      return mapUser(data.user, profile);
    } catch (error) {
      if (isMissingSessionError(error)) {
        return null;
      }
      return rejectWithValue(error instanceof Error ? error.message : translateClientMessage('errors.failedToFetchUser'));
    }
  }
);

export const signInWithPassword = createAsyncThunk<
  UserProfile,
  { email: string; password: string },
  { rejectValue: string }
>('auth/signInWithPassword', async ({ email, password }, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
    if (!data.user) {
      throw new Error(translateClientMessage('errors.missingUserAfterSignIn'));
    }
    const profile = await ensureProfile(data.user);
    return mapUser(data.user, profile);
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : translateClientMessage('errors.signInFailed'));
  }
});

export const signUpWithPassword = createAsyncThunk<
  SignUpResult,
  { email: string; password: string; name?: string },
  { rejectValue: string }
>('auth/signUpWithPassword', async ({ email, password, name }, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name ?? '' },
      },
    });

    if (error) {
      if (isDuplicateEmailErrorMessage(error.message)) {
        return {
          status: 'email_already_registered',
          user: null,
        };
      }
      throw error;
    }

    if (!data.user || !data.session) {
      throw new Error(translateClientMessage('errors.signUpFailed'));
    }

    const profile = await ensureProfile(data.user);
    return {
      status: 'signed_in',
      user: mapUser(data.user, profile),
    };
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : translateClientMessage('errors.signUpFailed'));
  }
});

export const signInWithGoogle = createAsyncThunk<void, { nextPath?: string } | undefined, { rejectValue: string }>(
  'auth/signInWithGoogle',
  async (payload, { rejectWithValue }) => {
    try {
      const nextPath = payload?.nextPath;
      const callbackBase = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '';
      const redirectTo = nextPath ? `${callbackBase}?next=${encodeURIComponent(nextPath)}` : callbackBase;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });
      if (error) {
        throw error;
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : translateClientMessage('errors.googleSignInFailed'));
    }
  }
);

export const signOut = createAsyncThunk<void, void, { rejectValue: string }>('auth/signOut', async (_, { rejectWithValue }) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : translateClientMessage('errors.signOutFailed'));
  }
});

export const updateLocalCredits = createAsyncThunk<void, number>('auth/updateLocalCredits', async () => {
  return;
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError: (state) => {
      state.error = null;
    },
    setUserCredits: (state, action: PayloadAction<number>) => {
      if (state.user) {
        state.user.credits = action.payload;
      }
    },
    setUserProfilePartial: (state, action: PayloadAction<Partial<UserProfile>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.loading = false;
        const message = action.payload ?? translateClientMessage('errors.failedToFetchUser');
        state.error = isMissingSessionMessage(message) ? null : message;
        state.user = null;
      })
      .addCase(signInWithPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signInWithPassword.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(signInWithPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? translateClientMessage('errors.signInFailed');
      })
      .addCase(signUpWithPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signUpWithPassword.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
      })
      .addCase(signUpWithPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? translateClientMessage('errors.signUpFailed');
      })
      .addCase(signOut.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signOut.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
      })
      .addCase(signOut.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? translateClientMessage('errors.signOutFailed');
      });
  },
});

export const { clearAuthError, setUserCredits, setUserProfilePartial } = authSlice.actions;

export const selectAuthState = (state: { auth: AuthState }) => state.auth;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => !!state.auth.user && !state.auth.user.is_anonymous;
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.loading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;

export default authSlice.reducer;
