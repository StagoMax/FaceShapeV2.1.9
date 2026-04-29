import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as Application from 'expo-application';
import { CreditTransaction, User } from '../../types';
import { supabaseHelpers, TABLES } from '../../services/supabase';
import { APP_CONFIG, CREDITS } from '../../constants';

// Define the initial state
interface CreditState {
  transactions: CreditTransaction[];
  isLoading: boolean;
  isProcessing: boolean;
  error: string | null;
}

const initialState: CreditState = {
  transactions: [],
  isLoading: false,
  isProcessing: false,
  error: null,
};

type PurchaseCreditsResult = {
  status: 'pending' | 'completed';
  newCredits?: number;
  transaction?: CreditTransaction;
};

type CreditMutationResult = {
  newCredits: number;
  transaction?: CreditTransaction;
};

// Async thunks for credit operations
export const purchaseCredits = createAsyncThunk<
  PurchaseCreditsResult,
  { packageId: string; purchaseToken: string; orderId?: string },
  { rejectValue: string }
>(
  'credit/purchaseCredits',
  async ({ packageId, purchaseToken, orderId }, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { auth: { user: User | null } };
      const user = state.auth.user;
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Find the credit package
      const creditPackage = CREDITS.PACKAGES.find(pkg => pkg.id === packageId);
      if (!creditPackage) {
        throw new Error('Invalid credit package');
      }

      const packageName = Application.applicationId ?? APP_CONFIG.BUNDLE_ID;

      const result = await supabaseHelpers.verifyGooglePlayPurchase({
        packageName,
        productId: packageId,
        purchaseToken,
        orderId,
        userId: user.id,
      });

      return {
        status: result.status,
        newCredits: result.newCredits,
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to purchase credits');
    }
  }
);

export const consumeCredits = createAsyncThunk<
  CreditMutationResult,
  { amount: number; description: string },
  { rejectValue: string }
>(
  'credit/consumeCredits',
  async ({ amount, description }, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { auth: { user: User | null } };
      const user = state.auth.user;
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const newCredits = await supabaseHelpers.consumeUserCredits(amount, description);
      return { newCredits };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to consume credits');
    }
  }
);

export const getCreditTransactions = createAsyncThunk(
  'credit/getCreditTransactions',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { auth: { user: User | null } };
      const user = state.auth.user;
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const transactions = await supabaseHelpers.getRecords(TABLES.CREDIT_TRANSACTIONS, { user_id: user.id });
      return transactions as CreditTransaction[];
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to get credit transactions');
    }
  }
);

export const addDailyFreeCredits = createAsyncThunk<
  CreditMutationResult,
  void,
  { rejectValue: string }
>(
  'credit/addDailyFreeCredits',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { auth: { user: User | null } };
      const user = state.auth.user;
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const newCredits = await supabaseHelpers.claimDailyFreeCredits();
      return { newCredits };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to add daily credits');
    }
  }
);

// Create the credit slice
const creditSlice = createSlice({
  name: 'credit',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setTransactions: (state, action: PayloadAction<CreditTransaction[]>) => {
      state.transactions = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Purchase Credits
    builder
      .addCase(purchaseCredits.pending, (state) => {
        state.isProcessing = true;
        state.error = null;
      })
      .addCase(purchaseCredits.fulfilled, (state, action) => {
        state.isProcessing = false;
        if (action.payload.transaction) {
          state.transactions.unshift(action.payload.transaction);
        }
        state.error = null;
      })
      .addCase(purchaseCredits.rejected, (state, action) => {
        state.isProcessing = false;
        state.error = action.payload as string;
      })
      // Consume Credits
      .addCase(consumeCredits.pending, (state) => {
        state.isProcessing = true;
        state.error = null;
      })
      .addCase(consumeCredits.fulfilled, (state, action) => {
        state.isProcessing = false;
        if (action.payload.transaction) {
          state.transactions.unshift(action.payload.transaction);
        }
        state.error = null;
      })
      .addCase(consumeCredits.rejected, (state, action) => {
        state.isProcessing = false;
        state.error = action.payload as string;
      })
      // Get Credit Transactions
      .addCase(getCreditTransactions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getCreditTransactions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.transactions = action.payload;
        state.error = null;
      })
      .addCase(getCreditTransactions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Add Daily Free Credits
      .addCase(addDailyFreeCredits.pending, (state) => {
        state.isProcessing = true;
        state.error = null;
      })
      .addCase(addDailyFreeCredits.fulfilled, (state, action) => {
        state.isProcessing = false;
        if (action.payload.transaction) {
          state.transactions.unshift(action.payload.transaction);
        }
        state.error = null;
      })
      .addCase(addDailyFreeCredits.rejected, (state, action) => {
        state.isProcessing = false;
        state.error = action.payload as string;
      });
  },
});

// Export actions
export const { clearError, setTransactions } = creditSlice.actions;

// Export reducer
export default creditSlice.reducer;

// Selectors
export const selectCreditTransactions = (state: { credit: CreditState }) => state.credit.transactions;
export const selectCreditLoading = (state: { credit: CreditState }) => state.credit.isLoading;
export const selectCreditProcessing = (state: { credit: CreditState }) => state.credit.isProcessing;
export const selectCreditError = (state: { credit: CreditState }) => state.credit.error;
