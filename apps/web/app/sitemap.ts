import type { MetadataRoute } from 'next';
import { INDEXABLE_PATHS, toAbsoluteUrl } from '@/lib/seo';

const PRIORITY: Record<(typeof INDEXABLE_PATHS)[number], number> = {
  '/': 1,
  '/privacy': 0.35,
  '/terms': 0.35,
  '/account-deletion': 0.3,
};

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return INDEXABLE_PATHS.map((path) => ({
    url: toAbsoluteUrl(path),
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: PRIORITY[path],
  }));
}
