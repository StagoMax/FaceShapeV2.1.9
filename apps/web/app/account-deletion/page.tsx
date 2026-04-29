import type { Metadata } from 'next';
import LegalDocumentPage from '@/components/legal/LegalDocumentPage';
import { getAccountDeletionDocument } from '@/lib/i18n/legalContent';
import { resolveRequestLanguage } from '@/lib/i18n/request';

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveRequestLanguage();
  const document = getAccountDeletionDocument(language);

  return {
    title: document.metadataTitle,
    description: document.metadataDescription,
    alternates: {
      canonical: '/account-deletion',
    },
  };
}

export default async function AccountDeletionPage() {
  const language = await resolveRequestLanguage();
  return <LegalDocumentPage document={getAccountDeletionDocument(language)} />;
}
