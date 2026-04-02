'use client';

import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';

import Captain from '@/components/Captain/Captain';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import styles from '../auth.module.scss';

export default function RegisterPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
        await signup(email, password, firstName, lastName);
        router.push('/dashboard');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Registration failed');
      } finally {
        setLoading(false);
      }
    },
    [email, password, firstName, lastName, signup, router],
  );

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.mascot}>
          <Captain diverse size='md' alt='Captain PolicyPilot welcomes you' />
        </div>
        <h1 className={styles.heading}>Join the crew!</h1>
        <p className={styles.subheading}>Create your account to get started</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && (
            <p className={styles.error} role='alert'>
              {error}
            </p>
          )}

          <div className={styles.row}>
            <label className={styles.label}>
              First name
              <input
                className={styles.input}
                type='text'
                placeholder='First name'
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete='given-name'
              />
            </label>
            <label className={styles.label}>
              Last name
              <input
                className={styles.input}
                type='text'
                placeholder='Last name'
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete='family-name'
              />
            </label>
          </div>

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
              placeholder='Min 8 characters'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoComplete='new-password'
            />
          </label>

          <button
            className={styles.submitButton}
            type='submit'
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className={styles.switchLink}>
            Already have an account? <Link href='/login'>Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
