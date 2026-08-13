'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card/Card';
import { validateRedirectUrl } from '@/proxy';

const oauthErrorMessages: Record<string, string> = {
  invalid_state: 'Your sign-in session expired. Please try again.',
  account_collision: 'This account is already linked to another sign-in method. Please use that method instead.',
};

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const error = searchParams.get('error');

    if (error) {
      toast.error(oauthErrorMessages[error] ?? 'We could not complete sign-in. Please try again.');
      router.replace('/login');
      return;
    }

    toast.success('Successfully authenticated!');
    router.replace(validateRedirectUrl(searchParams.get('returnTo')));
  }, [searchParams, router]);

  return (
    <Card padding="lg">
      <div style={{ textAlign: 'center', padding: '2rem 0' }}>
        <h2 style={{ fontSize: '1.25rem', color: '#f8fafc', marginBottom: '0.5rem' }}>
          Completing sign in...
        </h2>
        <p style={{ color: '#94a3b8' }}>Please wait while we redirect you to your dashboard.</p>
      </div>
    </Card>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Card padding="lg">Loading...</Card>}>
      <AuthCallbackContent />
    </Suspense>
  );
}
