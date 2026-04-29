import type { Metadata } from 'next';
import LegalDocumentPage from '@/components/legal/LegalDocumentPage';
import { getTermsDocument } from '@/lib/i18n/legalContent';
import { resolveRequestLanguage } from '@/lib/i18n/request';

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveRequestLanguage();
  const document = getTermsDocument(language);

  return {
    title: document.metadataTitle,
    description: document.metadataDescription,
    alternates: {
      canonical: '/terms',
    },
  };
}

export default async function TermsOfServicePage() {
  const language = await resolveRequestLanguage();
  return <LegalDocumentPage document={getTermsDocument(language)} />;
}
