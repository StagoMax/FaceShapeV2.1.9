'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated, selectUser, signOut } from '@/store/slices/authSlice';

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [menuOpen]);

  const logout = async () => {
    setMenuOpen(false);
    await dispatch(signOut()).unwrap().catch(() => null);
    router.push('/');
  };

  const linkClass = (href: string) => (pathname === href ? 'nav-link nav-link-active' : 'nav-link');
  const avatarText = (user?.name || user?.email || 'U').trim().charAt(0).toUpperCase();
  const displayName = user?.name?.trim() || user?.email || '-';

  return (
    <header className="app-nav">
      <div className="app-nav-inner">
        <div className="nav-left">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden>
              <Image src="/icon.png" alt="" width={44} height={44} />
            </span>
            <span>{t('common.appName')}</span>
          </Link>
          <nav className="nav-links">
            <Link href="/" className={linkClass('/')}>
              {t('nav.home')}
            </Link>
            <Link href="/editor" className={linkClass('/editor')}>
              {t('nav.editor')}
            </Link>
            <Link href="/purchase" className={linkClass('/purchase')}>
              {t('nav.purchase')}
            </Link>
          </nav>
        </div>
        <div className="nav-actions">
          {isAuthenticated && user ? (
            <>
              <Link href="/purchase" className="nav-credit-pill">
                <span className="nav-credit-count">{user.credits ?? 0}</span>
                <span>{t('purchase.creditsUnit')}</span>
              </Link>
              <div
                ref={menuRef}
                className={`user-menu${menuOpen ? ' user-menu-open' : ''}`}
                onMouseEnter={() => setMenuOpen(true)}
              >
                <button
                  className="user-avatar"
                  type="button"
                  aria-label={t('common.appName')}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((prev) => !prev)}
                >
                  {user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar_url} alt={displayName} />
                  ) : (
                    <span>{avatarText}</span>
                  )}
                </button>
                <div className="user-menu-dropdown">
                  <div className="user-menu-head">
                    <div className="user-menu-name">{displayName}</div>
                    <div className="user-menu-email">{user.email}</div>
                  </div>
                  <Link href="/settings" className="user-menu-item" onClick={() => setMenuOpen(false)}>
                    {t('nav.settings')}
                  </Link>
                  <button className="user-menu-item user-menu-button" onClick={logout}>
                    {t('nav.logout')}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link className="button button-secondary" href="/login">
                {t('nav.login')}
              </Link>
              <Link className="button" href="/register">
                {t('nav.register')}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
