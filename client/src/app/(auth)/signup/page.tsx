'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/shared/auth/auth-context';
import { Card } from '@/components/ui/Card/Card';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { Mail, Lock } from 'lucide-react';
import styles from './SignupPage.module.css';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!email) nextErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) nextErrors.email = 'Invalid email address';
    if (!password) nextErrors.password = 'Password is required';
    else if (password.length < 6) nextErrors.password = 'Password must be at least 6 characters';
    if (password !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    const res = await signup(email, password);
    setIsSubmitting(false);

    if (res.success) {
      toast.success('Successfully signed up! Welcome to Varta.');
      router.push('/analytics');
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

      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          type="email"
          label="Email Address"
          placeholder="name@company.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={errors.email}
          disabled={isSubmitting}
          required
        />

        <Input
          type="password"
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          error={errors.password}
          disabled={isSubmitting}
          required
        />

        <Input
          type="password"
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

      <div className={styles.divider}>
        <span>Or continue with</span>
      </div>

      <div className={styles.oauthProviders}>
        <Button 
          variant="secondary" 
          className={styles.oauthBtn}
          onClick={() => window.location.href = 'http://localhost:5000/api/v1/auth/google'}
        >
          Google
        </Button>
        <Button 
          variant="secondary" 
          className={styles.oauthBtn}
          onClick={() => window.location.href = 'http://localhost:5000/api/v1/auth/github'}
        >
          GitHub
        </Button>
      </div>

      <div className={styles.footer}>
        <span>Already have an account?</span>{' '}
        <Link href="/login" className={styles.link}>
          Sign In
        </Link>
      </div>
    </Card>
  );
}
