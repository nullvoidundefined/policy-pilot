'use client';

/**
 * Site-wide navigation header with the PolicyPilot logo, main nav links, and
 * an auth control that toggles between Sign In and Log Out based on session state.
 */
import { useAuth } from '@/state/AuthContext';
import Image from 'next/image';
import Link from 'next/link';

import styles from './Header.module.scss';

export default function Header() {
  const { user, logout, isLoading } = useAuth();

  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label='Main navigation'>
        <Link href='/' className={styles.logoLink}>
          <Image
            src='/logo.svg'
            alt='PolicyPilot'
            width={140}
            height={32}
            priority
          />
        </Link>

        <ul className={styles.links}>
          <li>
            <Link href='/demo' className={styles.link}>
              Demo
            </Link>
          </li>
          {user && (
            <li>
              <Link href='/dashboard' className={styles.link}>
                Dashboard
              </Link>
            </li>
          )}
        </ul>

        <div className={styles.auth}>
          {isLoading ? null : user ? (
            <button onClick={logout} className={styles.logoutButton}>
              Log Out
            </button>
          ) : (
            <Link href='/login' className={styles.signInLink}>
              Sign In
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
