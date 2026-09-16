'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/shared/auth/auth-context';
import { Card } from '@/components/ui/Card/Card';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { OAuthProviderIcon } from '@/components/auth/OAuthProviderIcon';
import styles from './SignupPage.module.css';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!name || name.trim().length < 2) nextErrors.name = 'Name must be at least 2 characters';
    if (!email) nextErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) nextErrors.email = 'Invalid email address';
    if (!password) {
      nextErrors.password = 'Password is required';
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      nextErrors.password = 'Password must contain uppercase, lowercase, and number';
    }
    if (password !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match';

    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) window.requestAnimationFrame(() => document.getElementById(`signup-${firstError}`)?.focus());
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    const res = await signup(name, email, password);
    setIsSubmitting(false);

    if (res.success) {
      toast.success('Account created. Check your email to verify it before signing in.');
      router.push('/login?registered=true');
    } else {
      toast.error(res.error || 'Registration failed');
    }
  };

  return (
    <Card padding="lg">
      <div className={styles.header}>
        <h2 className={styles.title}>Create your account</h2>
        <p className={styles.subtitle}>Get started with Varta notification pipeline</p>
      </div>

      <div className={styles.divider} role="separator">
        <span>or continue with</span>
      </div>
      <div className={styles.oauthProviders}>
        <a href="/api/v1/auth/oauth/google" className={`${styles.oauthBtn} ${styles.googleBtn}`}>
          <OAuthProviderIcon provider="google" />
          <span>Continue with Google</span>
        </a>
        <a href="/api/v1/auth/oauth/github" className={`${styles.oauthBtn} ${styles.githubBtn}`}>
          <OAuthProviderIcon provider="github" />
          <span>Continue with GitHub</span>
        </a>
      </div>

      <form onSubmit={handleSubmit} className={styles.form} noValidate aria-live="polite">
        <Input
          id="signup-name"
          type="text"
          name="name"
          autoComplete="name"
          label="Full Name"
          placeholder="Jane Doe"
          value={name}
          onChange={e => setName(e.target.value)}
          error={errors.name}
          disabled={isSubmitting}
          required
        />

        <Input
          id="signup-email"
          type="email"
          name="email"
          autoComplete="email"
          label="Email Address"
          placeholder="name@company.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={errors.email}
          disabled={isSubmitting}
          required
        />

        <Input
          id="signup-password"
          type="password"
          name="password"
          autoComplete="new-password"
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          error={errors.password}
          disabled={isSubmitting}
          required
        />

        <Input
          id="signup-confirmPassword"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          label="Confirm Password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          disabled={isSubmitting}
          required
        />

        <Button 
          type="submit" 
          variant="primary" 
          size="lg" 
          loading={isSubmitting}
          className={styles.submitBtn}
        >
          Create Account
        </Button>
      </form>

      <div className={styles.footer}>
        <span>Already have an account?</span>{' '}
        <Link href="/login" className={styles.link}>
          Sign In
        </Link>
      </div>
    </Card>
  );
}
