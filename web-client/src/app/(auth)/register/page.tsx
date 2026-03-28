'use client';

import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';

import { useAuth } from '@/context/AuthContext';
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
        router.push('/documents');
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
      <form className={styles.form} onSubmit={handleSubmit}>
        <h1 className={styles.heading}>Sign Up</h1>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.row}>
          <input
            className={styles.input}
            type='text'
            placeholder='First name'
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <input
            className={styles.input}
            type='text'
            placeholder='Last name'
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
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
          placeholder='Password (min 8 characters)'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <button
          className={styles.submitButton}
          type='submit'
          disabled={loading}
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
        <p className={styles.switchLink}>
          Already have an account? <a href='/login'>Log in</a>
        </p>
      </form>
    </div>
  );
}
