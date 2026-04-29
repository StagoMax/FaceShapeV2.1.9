'use client';

import React, { useEffect } from 'react';
import type { LanguageCode } from '@miriai/types';
import { Provider } from 'react-redux';
import { I18nProvider } from '@/lib/i18n/provider';
import { supabase } from '@/lib/supabase';
import { store } from '@/store';
import { useAppDispatch } from '@/store/hooks';
import { fetchCurrentUser } from '@/store/slices/authSlice';

function Bootstrapper({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      dispatch(fetchCurrentUser());
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch]);

  return <>{children}</>;
}

export default function Providers({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage: LanguageCode;
}) {
  return (
    <Provider store={store}>
      <I18nProvider initialLanguage={initialLanguage}>
        <Bootstrapper>{children}</Bootstrapper>
      </I18nProvider>
    </Provider>
  );
}
