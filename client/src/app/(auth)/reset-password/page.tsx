'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card/Card';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { apiClient } from '@/shared/api/api';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialToken = searchParams.get('token');
  const [token, setToken] = useState<string | null>(initialToken);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialToken) {
      setToken(initialToken);
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [initialToken]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!token) nextErrors.token = 'Missing reset token';
    if (!password || password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters';
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    const res = await apiClient.post('/api/v1/auth/reset-password', { token, newPassword: password }, { skipAuth: true });
    setIsSubmitting(false);

    if (res.success) {
      toast.success('Password successfully reset! You can now log in.');
      router.push('/login');
    } else {
      const msg = res.error?.message || 'Failed to reset password';
      toast.error(msg);
      setErrors({ form: msg });
    }
  };

  if (!token) {
    return (
      <Card padding="lg">
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#ef4444', marginBottom: '0.5rem' }}>Invalid Request</h2>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
            No password reset token was provided.
          </p>
          <Link href="/forgot-password" style={{ color: '#6366f1', textDecoration: 'underline' }}>
            Request a new reset link
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>
          Set New Password
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
          Choose a strong password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Input
          type="password"
          label="New Password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          disabled={isSubmitting}
          required
        />

        <Input
          type="password"
          label="Confirm New Password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          disabled={isSubmitting}
          required
        />

        {errors.form && (
          <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {errors.form}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isSubmitting}
          style={{ width: '100%', marginTop: '1.5rem' }}
        >
          Reset Password
        </Button>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Card padding="lg">Loading...</Card>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
