'use client';

import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';

import Captain from '@/components/Captain/Captain';
import { useAuth } from '@/context/AuthContext';
import {
  createCollectionApi,
  deleteCollectionApi,
  getCollections,
} from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

import styles from './dashboard.module.scss';

interface Collection {
  id: string;
  name: string;
  description: string | null;
  is_demo: boolean;
  document_count: number;
  created_at: string;
}

export default function DashboardPage() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: getCollections,
  });

  const collections: Collection[] = (data?.collections as Collection[]) ?? [];

  const handleCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!newName.trim()) return;

      setCreateError('');
      setCreating(true);
      try {
        await createCollectionApi(
          newName.trim(),
          newDescription.trim() || undefined,
        );
        void queryClient.invalidateQueries({ queryKey: ['collections'] });
        setNewName('');
        setNewDescription('');
        setShowCreate(false);
      } catch (err) {
        setCreateError(
          err instanceof Error ? err.message : 'Failed to create collection',
        );
      } finally {
        setCreating(false);
      }
    },
    [newName, newDescription, queryClient],
  );

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const prev = queryClient.getQueryData<{ collections: Collection[] }>([
        'collections',
      ]);
      queryClient.setQueryData<{ collections: Collection[] }>(
        ['collections'],
        (old) => ({
          collections: (old?.collections ?? []).filter((c) => c.id !== id),
        }),
      );
      try {
        await deleteCollectionApi(id);
      } catch {
        queryClient.setQueryData(['collections'], prev);
      }
    },
    [queryClient],
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Your Flight Plans</h1>
        <div className={styles.headerActions}>
          <button
            className={styles.newButton}
            onClick={() => setShowCreate(!showCreate)}
            aria-expanded={showCreate}
          >
            New Collection
          </button>
          <button className={styles.logoutButton} onClick={() => logout()}>
            Log Out
          </button>
        </div>
      </header>

      {showCreate && (
        <form
          className={styles.createForm}
          onSubmit={handleCreate}
          aria-label='Create new collection'
        >
          <div className={styles.createFormRow}>
            <div className={styles.createFormField}>
              <label
                className={styles.createFormLabel}
                htmlFor='collection-name'
              >
                Name
              </label>
              <input
                id='collection-name'
                className={styles.createFormInput}
                type='text'
                placeholder='e.g. Employee Handbook 2026'
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div className={styles.createFormField}>
              <label
                className={styles.createFormLabel}
                htmlFor='collection-desc'
              >
                Description (optional)
              </label>
              <input
                id='collection-desc'
                className={styles.createFormInput}
                type='text'
                placeholder='Brief description'
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
          </div>
          {createError && <p className={styles.createError}>{createError}</p>}
          <div className={styles.createFormActions}>
            <button
              className={styles.createSubmit}
              type='submit'
              disabled={creating}
            >
              {creating ? 'Filing flight plan...' : 'Create'}
            </button>
            <button
              className={styles.createCancel}
              type='button'
              onClick={() => {
                setShowCreate(false);
                setNewName('');
                setNewDescription('');
                setCreateError('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className={styles.loading}>
          <Captain
            pose='thinking'
            size='sm'
            alt='Captain PolicyPilot is thinking'
          />
          <span>Scanning the flight manifest...</span>
        </div>
      ) : collections.length === 0 ? (
        <div className={styles.emptyState}>
          <Captain
            pose='clipboard'
            size='md'
            alt='Captain PolicyPilot with clipboard'
          />
          <p className={styles.emptyText}>
            No collections yet &mdash; let&apos;s get you loaded up, co-pilot!
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {collections.map((col) => (
            <Link
              key={col.id}
              href={`/collections/${col.id}`}
              className={styles.card}
              aria-label={`Open collection: ${col.name}`}
            >
              <div className={styles.cardHeader}>
                <span className={styles.cardName}>{col.name}</span>
                {col.is_demo && <span className={styles.demoBadge}>Demo</span>}
              </div>

              <div className={styles.cardMeta}>
                <span className={styles.docCount}>
                  {col.document_count}{' '}
                  {col.document_count === 1 ? 'doc' : 'docs'}
                </span>
                <span className={styles.cardDate}>
                  {formatDate(col.created_at)}
                </span>
                {!col.is_demo && (
                  <button
                    className={styles.deleteCardButton}
                    onClick={(e) => handleDelete(e, col.id)}
                    aria-label={`Delete collection ${col.name}`}
                  >
                    Delete
                  </button>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
