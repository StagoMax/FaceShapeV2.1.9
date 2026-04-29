import type { ImageSourcePropType } from 'react-native';

import type { LanguageCode } from './i18n';

export interface InspirationItem {
  id: string;
  title: string;
  image?: ImageSourcePropType;
}

export const HOME_INSPIRATION_ITEMS: Record<LanguageCode, InspirationItem[]> = {
  zh: [
    // Add carousel items here. Use local assets instead of placeholders.
    // { id: '1', title: 'Sample', image: require('../../assets/inspiration/sample-1.png') },
  ],
  'zh-TW': [],
  en: [],
  ja: [],
};
