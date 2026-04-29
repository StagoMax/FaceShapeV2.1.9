import type { MetadataRoute } from 'next';
import { SITE_URL, toAbsoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/privacy', '/terms', '/account-deletion'],
        disallow: ['/editor', '/login', '/register', '/purchase', '/settings', '/auth/'],
      },
    ],
    sitemap: toAbsoluteUrl('/sitemap.xml'),
    host: SITE_URL,
  };
}
