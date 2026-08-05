'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card/Card';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { apiClient } from '@/shared/api/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const res = await apiClient.post('/api/v1/auth/forgot-password', { email });
    setIsSubmitting(false);

    if (res.success) {
      setSubmitted(true);
      toast.success('Password reset link sent to your email.');
    } else {
      const msg = res.error?.message || 'Failed to send reset link';
      toast.error(msg);
      setError(msg);
    }
  };

  return (
    <Card padding="lg">
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>
          Forgot your password?
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
          Enter your email address and we'll send you a password reset link.
        </p>
      </div>

      {submitted ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#10b981', marginBottom: '1.5rem' }}>
            Check your inbox for a password reset email.
          </p>
          <Link href="/login" style={{ color: '#6366f1', textDecoration: 'underline' }}>
            Back to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <Input
            type="email"
            label="Email Address"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
            disabled={isSubmitting}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isSubmitting}
            style={{ width: '100%', marginTop: '1rem' }}
          >
            Send Reset Link
          </Button>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem' }}>
            <Link href="/login" style={{ color: '#94a3b8' }}>
              Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </Card>
  );
}
