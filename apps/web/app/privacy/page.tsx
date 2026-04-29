import type { Metadata } from 'next';
import LegalDocumentPage from '@/components/legal/LegalDocumentPage';
import { getPrivacyDocument } from '@/lib/i18n/legalContent';
import { resolveRequestLanguage } from '@/lib/i18n/request';

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveRequestLanguage();
  const document = getPrivacyDocument(language);

  return {
    title: document.metadataTitle,
    description: document.metadataDescription,
    alternates: {
      canonical: '/privacy',
    },
  };
}

export default async function PrivacyPolicyPage() {
  const language = await resolveRequestLanguage();
  return <LegalDocumentPage document={getPrivacyDocument(language)} />;
}
