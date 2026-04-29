import { headers } from 'next/headers';
import AuthGuard from '@/components/AuthGuard';
import PurchaseContent from '@/components/purchase/PurchaseContent';

const COUNTRY_HEADER_KEY = 'x-miri-country';

export default async function PurchasePage() {
  const headerStore = await headers();
  const initialCountryCode =
    (headerStore.get(COUNTRY_HEADER_KEY) ?? headerStore.get('x-vercel-ip-country') ?? '').trim().toUpperCase() || null;

  return (
    <AuthGuard>
      <PurchaseContent initialCountryCode={initialCountryCode} />
    </AuthGuard>
  );
}
