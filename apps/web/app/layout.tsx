import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import Providers from '@/components/Providers';
import AppNav from '@/components/AppNav';
import { resolveRequestLanguage } from '@/lib/i18n/request';
import { LANGUAGE_TAGS, OPEN_GRAPH_LOCALES } from '@/lib/i18n/shared';
import { getSiteSeoCopy, SITE_NAME, toAbsoluteUrl } from '@/lib/seo';

const GOOGLE_ADS_TAG_ID = 'AW-18023005247';

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveRequestLanguage();
  const siteCopy = getSiteSeoCopy(language);

  return {
    metadataBase: new URL(toAbsoluteUrl('/')),
    applicationName: SITE_NAME,
    title: {
      default: siteCopy.title,
      template: '%s | Miri',
    },
    description: siteCopy.description,
    keywords: siteCopy.keywords,
    alternates: {
      canonical: '/',
    },
    openGraph: {
      type: 'website',
      locale: OPEN_GRAPH_LOCALES[language],
      url: '/',
      siteName: SITE_NAME,
      title: siteCopy.title,
      description: siteCopy.description,
      images: [
        {
          url: '/icon.png',
          width: 512,
          height: 512,
          alt: `${SITE_NAME} logo`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: siteCopy.title,
      description: siteCopy.description,
      images: ['/icon.png'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const language = await resolveRequestLanguage();

  return (
    <html lang={LANGUAGE_TAGS[language]}>
      <head>
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_TAG_ID}`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GOOGLE_ADS_TAG_ID}');
            `,
          }}
        />
      </head>
      <body>
        <Providers initialLanguage={language}>
          <AppNav />
          {children}
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
