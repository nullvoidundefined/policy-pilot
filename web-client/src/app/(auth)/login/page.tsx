'use client';

import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';

import { useAuth } from '@/context/AuthContext';
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
        router.push('/documents');
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
      <form className={styles.form} onSubmit={handleSubmit}>
        <h1 className={styles.heading}>Log In</h1>
        {error && <p className={styles.error}>{error}</p>}
        <input
          className={styles.input}
          type='email'
          placeholder='Email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className={styles.input}
          type='password'
          placeholder='Password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          className={styles.submitButton}
          type='submit'
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Log In'}
        </button>
        <p className={styles.switchLink}>
          Don&apos;t have an account? <a href='/register'>Sign up</a>
        </p>
      </form>
    </div>
  );
}
