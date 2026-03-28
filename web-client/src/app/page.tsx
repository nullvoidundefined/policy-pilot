'use client';

import { useAuth } from '@/context/AuthContext';

import styles from './page.module.scss';

export default function HomePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className={styles.container}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.hero}>
          <h1 className={styles.title}>DocQA</h1>
          <p className={styles.subtitle}>
            Upload documents, ask questions, get grounded answers with source
            citations.
          </p>
          <div className={styles.actions}>
            <a href='/login' className={styles.primaryButton}>
              Log In
            </a>
            <a href='/register' className={styles.secondaryButton}>
              Sign Up
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>DocQA</h1>
        <p className={styles.subtitle}>
          Welcome back, {user.first_name || user.email}
        </p>
        <div className={styles.actions}>
          <a href='/documents' className={styles.primaryButton}>
            My Documents
          </a>
          <a href='/chat' className={styles.secondaryButton}>
            Ask a Question
          </a>
        </div>
      </div>
    </div>
  );
}
