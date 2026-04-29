import type { Metadata } from 'next';
import Link from 'next/link';
import { resolveRequestLanguage } from '@/lib/i18n/request';
import { translateMessage } from '@/lib/i18n/runtime';
import { SITE_NAME } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveRequestLanguage();
  return {
    title: translateMessage(language, 'unavailable.title'),
    description: translateMessage(language, 'unavailable.description'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function UnavailablePage() {
  const language = await resolveRequestLanguage();

  return (
    <main className="app-main" style={{ minHeight: 'calc(100dvh - 84px)', display: 'grid', placeItems: 'center' }}>
      <section className="card" style={{ width: 'min(100%, 720px)', textAlign: 'center', display: 'grid', gap: 18 }}>
        <p
          style={{
            margin: 0,
            justifySelf: 'center',
            padding: '8px 12px',
            borderRadius: 999,
            background: 'rgba(27, 26, 24, 0.06)',
            color: 'rgba(79, 75, 69, 0.82)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {translateMessage(language, 'unavailable.badge')}
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'clamp(32px, 4vw, 44px)',
              lineHeight: 1.02,
              letterSpacing: '-0.04em',
            }}
          >
            {translateMessage(language, 'unavailable.heading', { appName: SITE_NAME })}
          </h1>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 16, lineHeight: 1.7 }}>
            {translateMessage(language, 'unavailable.subtitle')}
          </p>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.7 }}>
            {translateMessage(language, 'unavailable.usNote')}
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link className="button" href="/terms">
            {translateMessage(language, 'unavailable.terms')}
          </Link>
          <Link className="button button-secondary" href="/privacy">
            {translateMessage(language, 'unavailable.privacy')}
          </Link>
        </div>
      </section>
    </main>
  );
}
