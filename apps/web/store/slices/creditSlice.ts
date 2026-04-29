'use client';

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type {
  CreditPackageId,
  PaypalCaptureOrderRequest,
  PaypalCaptureOrderResponse,
  PaypalCreateOrderRequest,
  PaypalCreateOrderResponse,
} from '@miriai/types';
import { translateClientMessage } from '@/lib/i18n/runtime';
import { supabase } from '@/lib/supabase';
import { invokeEdgeFunction } from '@/lib/supabaseEdge';
import { setUserCredits } from './authSlice';

const formatFunctionError = async (error: unknown, fallback: string) => {
  const response = (error as { context?: Response } | null)?.context;
  if (response instanceof Response) {
    try {
      const payload = await response.clone().json();
      if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
      if (typeof payload?.error === 'string' && payload.error.trim()) {
        return payload.error;
      }
      return JSON.stringify(payload);
    } catch {
      try {
        const text = await response.clone().text();
        if (text.trim()) {
          return text;
        }
      } catch {
        // Ignore body parsing failures and fall back below.
      }
    }
  }

  return error instanceof Error ? error.message : fallback;
};

interface CreditState {
  balance: number;
  loadingBalance: boolean;
  processingPayment: boolean;
  error: string | null;
  lastOrderId: string | null;
}

const initialState: CreditState = {
  balance: 0,
  loadingBalance: false,
  processingPayment: false,
  error: null,
  lastOrderId: null,
};

export const fetchCreditBalance = createAsyncThunk<number, void, { rejectValue: string }>(
  'credit/fetchCreditBalance',
  async (_, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase.rpc('get_user_credit_balance');
      if (error) {
        throw error;
      }
      return typeof data === 'number' ? data : 0;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : translateClientMessage('errors.failedToFetchCreditBalance'));
    }
  }
);

export const createPaypalOrder = createAsyncThunk<
  PaypalCreateOrderResponse,
  PaypalCreateOrderRequest,
  { rejectValue: string }
>('credit/createPaypalOrder', async (payload, { rejectWithValue }) => {
  try {
    const data = await invokeEdgeFunction<PaypalCreateOrderResponse>('paypal-create-order', payload);
    if (!data?.orderId) {
      throw new Error(translateClientMessage('errors.failedToCreatePayPalOrder'));
    }
    return data;
  } catch (error) {
    return rejectWithValue(await formatFunctionError(error, translateClientMessage('errors.failedToCreatePayPalOrder')));
  }
});

export const capturePaypalOrder = createAsyncThunk<
  PaypalCaptureOrderResponse,
  PaypalCaptureOrderRequest,
  { rejectValue: string }
>('credit/capturePaypalOrder', async (payload, { dispatch, rejectWithValue }) => {
  try {
    const data = await invokeEdgeFunction<PaypalCaptureOrderResponse>('paypal-capture-order', payload);
    if (!data) {
      throw new Error(translateClientMessage('errors.failedToCapturePayPalOrder'));
    }

    if (typeof data.newCredits === 'number') {
      dispatch(setUserCredits(data.newCredits));
    }

    return data;
  } catch (error) {
    return rejectWithValue(await formatFunctionError(error, translateClientMessage('errors.failedToCapturePayPalOrder')));
  }
});

const creditSlice = createSlice({
  name: 'credit',
  initialState,
  reducers: {
    clearCreditError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCreditBalance.pending, (state) => {
        state.loadingBalance = true;
        state.error = null;
      })
      .addCase(fetchCreditBalance.fulfilled, (state, action) => {
        state.loadingBalance = false;
        state.balance = action.payload;
      })
      .addCase(fetchCreditBalance.rejected, (state, action) => {
        state.loadingBalance = false;
        state.error = action.payload ?? translateClientMessage('errors.failedToFetchCreditBalance');
      })
      .addCase(createPaypalOrder.pending, (state) => {
        state.processingPayment = true;
        state.error = null;
      })
      .addCase(createPaypalOrder.fulfilled, (state, action) => {
        state.processingPayment = false;
        state.lastOrderId = action.payload.orderId;
      })
      .addCase(createPaypalOrder.rejected, (state, action) => {
        state.processingPayment = false;
        state.error = action.payload ?? translateClientMessage('errors.failedToCreatePayPalOrder');
      })
      .addCase(capturePaypalOrder.pending, (state) => {
        state.processingPayment = true;
        state.error = null;
      })
      .addCase(capturePaypalOrder.fulfilled, (state, action) => {
        state.processingPayment = false;
        if (typeof action.payload.newCredits === 'number') {
          state.balance = action.payload.newCredits;
        }
      })
      .addCase(capturePaypalOrder.rejected, (state, action) => {
        state.processingPayment = false;
        state.error = action.payload ?? translateClientMessage('errors.failedToCapturePayPalOrder');
      });
  },
});

export const { clearCreditError } = creditSlice.actions;

export const selectCreditBalance = (state: { credit: CreditState }) => state.credit.balance;
export const selectCreditLoading = (state: { credit: CreditState }) => state.credit.loadingBalance;
export const selectCreditProcessing = (state: { credit: CreditState }) => state.credit.processingPayment;
export const selectCreditError = (state: { credit: CreditState }) => state.credit.error;

export default creditSlice.reducer;
