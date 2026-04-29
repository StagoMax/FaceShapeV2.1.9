'use client';

import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import creditReducer from './slices/creditSlice';
import editorReducer from './slices/editorSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    credit: creditReducer,
    editor: editorReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
