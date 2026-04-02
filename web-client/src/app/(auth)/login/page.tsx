'use client';

import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';

import Captain from '@/components/Captain/Captain';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import styles from '../auth.module.scss';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
        await login(email, password);
        router.push('/dashboard');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login failed');
      } finally {
        setLoading(false);
      }
    },
    [email, password, login, router],
  );

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.mascot}>
          <Captain diverse size='md' alt='Captain PolicyPilot welcomes you' />
        </div>
        <h1 className={styles.heading}>Welcome aboard, co-pilot!</h1>
        <p className={styles.subheading}>Sign in to access your flight plans</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && (
            <p className={styles.error} role='alert'>
              {error}
            </p>
          )}

          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              type='email'
              placeholder='you@company.com'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete='email'
            />
          </label>

          <label className={styles.label}>
            Password
            <input
              className={styles.input}
              type='password'
              placeholder='Your password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete='current-password'
            />
          </label>

          <button
            className={styles.submitButton}
            type='submit'
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p className={styles.switchLink}>
            New here? <Link href='/register'>Join the crew</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
