'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { apiClient } from '@/shared/api/api';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Missing verification token in URL.');
      return;
    }

    apiClient.post('/api/v1/auth/verify-email', { token })
      .then((res) => {
        if (res.success) {
          setStatus('success');
        } else {
          setStatus('error');
          setErrorMessage(res.error?.message || 'Verification failed');
        }
      })
      .catch((err: any) => {
        setStatus('error');
        setErrorMessage(err?.message || 'Verification failed');
      });
  }, [token]);

  return (
    <Card padding="lg">
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem', color: '#f8fafc' }}>
          Email Verification
        </h2>
        {status === 'loading' && (
          <p style={{ color: '#94a3b8' }}>Verifying your email address, please wait...</p>
        )}
        {status === 'success' && (
          <div>
            <p style={{ color: '#10b981', marginBottom: '1.5rem' }}>
              Your email address has been successfully verified!
            </p>
            <Button variant="primary" size="lg" onClick={() => router.push('/login')}>
              Proceed to Sign In
            </Button>
          </div>
        )}
        {status === 'error' && (
          <div>
            <p style={{ color: '#ef4444', marginBottom: '1.5rem' }}>
              {errorMessage}
            </p>
            <Link href="/login" style={{ color: '#6366f1', textDecoration: 'underline' }}>
              Return to Sign In
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Card padding="lg">Loading...</Card>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
