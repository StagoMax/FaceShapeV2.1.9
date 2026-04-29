import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { User as SupabaseAuthUser, PostgrestError } from '@supabase/supabase-js';
import { User, UserProfile } from '../../types';
import { supabaseHelpers } from '../../services/supabase';
import type { OAuthProvider } from '../../services/supabase';
import { guestCreditsManager } from '../../utils/guestCredits';
import { anonMergeManager } from '../../utils/anonMerge';
import { purchaseCredits, consumeCredits, addDailyFreeCredits } from './creditSlice';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  isLoading: boolean;
  error: string | null;
  guestCredits: number | null;
}

interface AuthThunkResult {
  user: User | null;
  guestCredits?: number;
  requiresEmailVerification?: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isAnonymous: false,
  isLoading: false,
  error: null,
  guestCredits: null,
};

const isProfileNotFound = (error: unknown) => {
  const postgrestError = error as PostgrestError | undefined;
  return postgrestError?.code === 'PGRST116';
};

const mapSupabaseUserToAppUser = (authUser: SupabaseAuthUser, profile?: Partial<UserProfile> | null): User => ({
  id: authUser.id,
  email: authUser.email || '',
  is_anonymous: authUser.is_anonymous ?? false,
  name: profile?.name ?? (authUser.user_metadata?.name as string | undefined),
  avatar_url: profile?.avatar_url ?? (authUser.user_metadata?.avatar_url as string | undefined),
  credits: profile?.credits ?? 0,
  free_uses_remaining: profile?.free_uses_remaining ?? 0,
  ai_consent_at: profile?.ai_consent_at ?? null,
  privacy_policy_version: profile?.privacy_policy_version ?? null,
  terms_of_service_version: profile?.terms_of_service_version ?? null,
  created_at: authUser.created_at || new Date().toISOString(),
  updated_at:
    profile?.updated_at ||
    (authUser.updated_at as string | undefined) ||
    authUser.created_at ||
    new Date().toISOString(),
});

const deriveAuthFlags = (user: User | null) => {
  const isAnonymous = !!user?.is_anonymous;
  return {
    isAuthenticated: !!user && !isAnonymous,
    isAnonymous,
  };
};

const ensureUserProfile = async (
  authUser: SupabaseAuthUser,
  defaults: Pick<UserProfile, 'name' | 'avatar_url'> = {}
): Promise<UserProfile | null> => {
  try {
    const profile = await supabaseHelpers.getUserProfile(authUser.id);
    const updates: Record<string, any> = {};
    const preferredName = defaults.name ?? (authUser.user_metadata?.name as string | undefined);
    const preferredAvatar =
      defaults.avatar_url ?? (authUser.user_metadata?.avatar_url as string | undefined);

    if (!profile.name && preferredName) {
      updates.name = preferredName;
    }

    if (!profile.avatar_url && preferredAvatar) {
      updates.avatar_url = preferredAvatar;
    }

    if (Object.keys(updates).length > 0) {
      return await supabaseHelpers.upsertUserProfile(authUser.id, updates);
    }

    return profile;
  } catch (error) {
    if (!isProfileNotFound(error)) {
      throw error;
    }
    const fallbackPayload = {
      name: authUser.user_metadata?.name ?? defaults.name ?? null,
      avatar_url: authUser.user_metadata?.avatar_url ?? defaults.avatar_url ?? null,
    };
    return await supabaseHelpers.upsertUserProfile(authUser.id, fallbackPayload);
  }
};

export const signIn = createAsyncThunk<
  AuthThunkResult,
  { email: string; password: string },
  { rejectValue: string }
>('auth/signIn', async ({ email, password }, { rejectWithValue }) => {
  try {
    const { user: authUser } = await supabaseHelpers.signIn(email, password);
    if (!authUser) {
      return rejectWithValue('Sign-in failed, please check your email or password');
    }
    const profile = await ensureUserProfile(authUser);
    let mappedUser = mapSupabaseUserToAppUser(authUser, profile);
    try {
      const mergeResult = await anonMergeManager.mergeIfNeeded();
      if (mergeResult?.newCredits != null) {
        mappedUser = { ...mappedUser, credits: mergeResult.newCredits };
      }
    } catch (mergeError) {
      console.warn('[auth] merge anonymous credits failed', mergeError);
    }
    return { user: mappedUser };
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Sign in failed');
  }
});

export const signInWithProvider = createAsyncThunk<
  AuthThunkResult,
  { provider: OAuthProvider },
  { rejectValue: string }
>('auth/signInWithProvider', async ({ provider }, { rejectWithValue }) => {
  try {
    await supabaseHelpers.signInWithOAuth(provider);
    const authUser = await supabaseHelpers.getCurrentUser();
    if (!authUser) {
      return rejectWithValue('Sign-in failed, please try again later');
    }
    const profile = await ensureUserProfile(authUser);
    let mappedUser = mapSupabaseUserToAppUser(authUser, profile);
    try {
      const mergeResult = await anonMergeManager.mergeIfNeeded();
      if (mergeResult?.newCredits != null) {
        mappedUser = { ...mappedUser, credits: mergeResult.newCredits };
      }
    } catch (mergeError) {
      console.warn('[auth] merge anonymous credits failed', mergeError);
    }
    return { user: mappedUser };
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Social sign-in failed');
  }
});

export const signUp = createAsyncThunk<
  AuthThunkResult,
  { email: string; password: string; name?: string },
  { rejectValue: string }
>('auth/signUp', async ({ email, password, name }, { rejectWithValue }) => {
  try {
    const { user: authUser, session } = await supabaseHelpers.signUp(email, password, name);
    if (!authUser) {
      return { user: null, requiresEmailVerification: true };
    }

    const profileDefaults: Partial<UserProfile> = {
      name,
    };

    if (!session) {
      try {
        await ensureUserProfile(authUser, profileDefaults);
      } catch {
        // Ignore errors when session is not yet established (email verification flow)
      }
      return { user: null, requiresEmailVerification: true };
    }

    const profile = await ensureUserProfile(authUser, profileDefaults);
    let mappedUser = mapSupabaseUserToAppUser(authUser, profile ?? profileDefaults);
    try {
      const mergeResult = await anonMergeManager.mergeIfNeeded();
      if (mergeResult?.newCredits != null) {
        mappedUser = { ...mappedUser, credits: mergeResult.newCredits };
      }
    } catch (mergeError) {
      console.warn('[auth] merge anonymous credits failed', mergeError);
    }
    return {
      user: mappedUser,
      requiresEmailVerification: false,
    };
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Sign up failed');
  }
});

export const signOut = createAsyncThunk<
  AuthThunkResult,
  void,
  { rejectValue: string }
>('auth/signOut', async (_, { rejectWithValue }) => {
  try {
    await supabaseHelpers.signOut();
    const guestCredits = await guestCreditsManager.loadCredits();
    return { user: null, guestCredits };
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Sign out failed');
  }
});

export const getCurrentUser = createAsyncThunk<
  AuthThunkResult,
  void,
  { rejectValue: string }
>('auth/getCurrentUser', async (_, { rejectWithValue }) => {
  try {
    const authUser = await supabaseHelpers.getCurrentUser();
    if (!authUser) {
      const guestCredits = await guestCreditsManager.loadCredits();
      return { user: null, guestCredits };
    }

    const profile = await ensureUserProfile(authUser);
    let mappedUser = mapSupabaseUserToAppUser(authUser, profile);
    try {
      const mergeResult = await anonMergeManager.mergeIfNeeded();
      if (mergeResult?.newCredits != null) {
        mappedUser = { ...mappedUser, credits: mergeResult.newCredits };
      }
    } catch (mergeError) {
      console.warn('[auth] merge anonymous credits failed', mergeError);
    }
    return { user: mappedUser };
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to get current user'
    );
  }
});

export const loadGuestCredits = createAsyncThunk<
  number,
  void,
  { rejectValue: string }
>('auth/loadGuestCredits', async (_, { rejectWithValue }) => {
  try {
    return await guestCreditsManager.loadCredits();
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to load credits');
  }
});

export const consumeGuestCredit = createAsyncThunk<
  number,
  number | undefined,
  { rejectValue: string }
>('auth/consumeGuestCredit', async (amount = 1, { rejectWithValue }) => {
  try {
    return await guestCreditsManager.decrementCredits(amount);
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to update credits');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      const flags = deriveAuthFlags(action.payload);
      state.isAuthenticated = flags.isAuthenticated;
      state.isAnonymous = flags.isAnonymous;
    },
    updateUserCredits: (state, action: PayloadAction<number>) => {
      if (state.user) {
        state.user.credits = action.payload;
      }
    },
    updateUserProfile: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    setGuestCredits: (state, action: PayloadAction<number>) => {
      state.guestCredits = Math.max(0, action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signIn.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        const flags = deriveAuthFlags(action.payload.user);
        state.isAuthenticated = flags.isAuthenticated;
        state.isAnonymous = flags.isAnonymous;
        state.error = null;
      })
      .addCase(signIn.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? 'Sign-in failed';
        state.isAuthenticated = false;
        state.isAnonymous = false;
        state.user = null;
      })
      .addCase(signInWithProvider.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signInWithProvider.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        const flags = deriveAuthFlags(action.payload.user);
        state.isAuthenticated = flags.isAuthenticated;
        state.isAnonymous = flags.isAnonymous;
        state.error = null;
      })
      .addCase(signInWithProvider.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? 'Social sign-in failed';
        state.isAuthenticated = false;
        state.isAnonymous = false;
        state.user = null;
      })
      .addCase(signUp.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signUp.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        const flags = deriveAuthFlags(action.payload.user);
        state.isAuthenticated = flags.isAuthenticated;
        state.isAnonymous = flags.isAnonymous;
        state.error = null;
      })
      .addCase(signUp.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? 'Sign up failed';
        state.isAuthenticated = false;
        state.isAnonymous = false;
        state.user = null;
      })
      .addCase(signOut.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(signOut.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user ?? null;
        const flags = deriveAuthFlags(action.payload.user ?? null);
        state.isAuthenticated = flags.isAuthenticated;
        state.isAnonymous = flags.isAnonymous;
        state.guestCredits =
          typeof action.payload.guestCredits === 'number' ? action.payload.guestCredits : null;
        state.error = null;
      })
      .addCase(signOut.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? 'Sign out failed';
      })
      .addCase(getCurrentUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        const flags = deriveAuthFlags(action.payload.user);
        state.isAuthenticated = flags.isAuthenticated;
        state.isAnonymous = flags.isAnonymous;
        state.guestCredits = action.payload.user
          ? state.guestCredits
          : typeof action.payload.guestCredits === 'number'
            ? action.payload.guestCredits
            : state.guestCredits;
        state.error = null;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? 'Failed to get current user';
        state.isAuthenticated = false;
        state.isAnonymous = false;
        state.user = null;
      })
      .addCase(loadGuestCredits.fulfilled, (state, action) => {
        state.guestCredits = action.payload;
      })
      .addCase(loadGuestCredits.rejected, (state, action) => {
        state.guestCredits = state.guestCredits ?? 0;
        if (action.payload) {
          state.error = action.payload;
        }
      })
      .addCase(consumeGuestCredit.fulfilled, (state, action) => {
        state.guestCredits = action.payload;
      })
      .addCase(consumeGuestCredit.rejected, (state, action) => {
        if (action.payload) {
          state.error = action.payload;
        }
      })
      .addCase(purchaseCredits.fulfilled, (state, action) => {
        if (state.user && typeof action.payload.newCredits === 'number') {
          state.user.credits = action.payload.newCredits;
        }
      })
      .addCase(consumeCredits.fulfilled, (state, action) => {
        if (state.user && typeof action.payload.newCredits === 'number') {
          state.user.credits = action.payload.newCredits;
        }
      })
      .addCase(addDailyFreeCredits.fulfilled, (state, action) => {
        if (state.user && typeof action.payload.newCredits === 'number') {
          state.user.credits = action.payload.newCredits;
        }
      });
  },
});

export const {
  clearError,
  setUser,
  updateUserCredits,
  updateUserProfile,
  setGuestCredits,
} = authSlice.actions;

export default authSlice.reducer;

export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) =>
  state.auth.isAuthenticated;
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.isLoading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
export const selectGuestCredits = (state: { auth: AuthState }) => state.auth.guestCredits;
export const selectIsAnonymous = (state: { auth: AuthState }) => state.auth.isAnonymous;
