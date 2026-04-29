'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import { selectAuthLoading, selectIsAuthenticated } from '@/store/slices/authSlice';
import { useI18n } from '@/lib/i18n/provider';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const loading = useAppSelector(selectAuthLoading);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const next = encodeURIComponent(pathname || '/');
      router.replace(`/login?next=${next}`);
    }
  }, [isAuthenticated, loading, pathname, router]);

  if (loading) {
    return <div className="page-loading">{t('common.loading')}</div>;
  }

  if (!isAuthenticated) {
    return <div className="page-loading">{t('common.loginRequired')}</div>;
  }

  return <>{children}</>;
}
