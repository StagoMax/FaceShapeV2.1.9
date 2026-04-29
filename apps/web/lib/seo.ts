import type { LanguageCode } from '@miriai/types';

const DEFAULT_SITE_URL = 'https://www.miriai.app';

const normalizeSiteUrl = (raw?: string | null) => {
  const value = raw?.trim();
  if (!value) {
    return DEFAULT_SITE_URL;
  }

  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
};

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const SITE_NAME = 'Miri';
export const SITE_KEYWORDS = [
  'AI整容模拟',
  '整容模拟',
  '术前模拟',
  '鼻整形模拟',
  '隆鼻模拟',
  '下巴整形模拟',
  '轮廓整形模拟',
  'before after surgery simulation',
  'cosmetic surgery simulator',
  'rhinoplasty simulator',
  'chin augmentation simulator',
  'face contour surgery simulation',
  'plastic surgery preview',
  '美容整形シミュレーション',
  '鼻整形シミュレーション',
  '隆鼻シミュレーション',
  '顎整形シミュレーション',
  '輪郭整形シミュレーション',
  '術前シミュレーション',
];

const SITE_COPY: Record<LanguageCode, { title: string; description: string; keywords: string[] }> = {
  zh: {
    title: 'Miri AI 整容模拟',
    description:
      '上传照片后可模拟鼻整形、下巴整形与轮廓整形后的大致变化，生成 AI before/after 对比图，用于术前方案比较与咨询准备。',
    keywords: SITE_KEYWORDS,
  },
  'zh-TW': {
    title: 'Miri AI 整形模擬',
    description:
      '上傳照片後可模擬鼻整形、下巴整形與輪廓整形後的大致變化，生成 AI before/after 對比圖，用於術前方案比較與諮詢準備。',
    keywords: SITE_KEYWORDS,
  },
  en: {
    title: 'Miri AI Cosmetic Surgery Simulator',
    description:
      'Upload a portrait and simulate rhinoplasty, chin augmentation, and contour surgery changes with AI-generated before/after previews for pre-surgery comparison.',
    keywords: SITE_KEYWORDS,
  },
  ja: {
    title: 'Miri AI 美容整形シミュレーター',
    description:
      '写真をアップロードして鼻整形・顎整形・輪郭整形の変化をシミュレーションし、術前比較用の before/after プレビューを生成できます。',
    keywords: SITE_KEYWORDS,
  },
};

export const getSiteSeoCopy = (language: LanguageCode) => SITE_COPY[language] ?? SITE_COPY.en;
export const SITE_TITLE = SITE_COPY.zh.title;
export const SITE_DESCRIPTION = SITE_COPY.zh.description;

export const INDEXABLE_PATHS = ['/', '/privacy', '/terms', '/account-deletion'] as const;

export const toAbsoluteUrl = (path = '/') => {
  if (!path || path === '/') {
    return SITE_URL;
  }
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};
