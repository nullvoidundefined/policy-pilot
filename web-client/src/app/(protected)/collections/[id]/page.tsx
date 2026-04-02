'use client';

import { useCallback, useRef, useState } from 'react';

import Captain from '@/components/Captain/Captain';
import { del, get, post, uploadFile } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import styles from './collection.module.scss';

interface Document {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  total_chunks: number | null;
  error: string | null;
  rejection_reason: string | null;
  created_at: string;
}

interface CollectionDetail {
  id: string;
  name: string;
  description: string | null;
  is_demo: boolean;
  created_at: string;
}

export default function CollectionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const { data: collectionData, isLoading: collectionLoading } = useQuery({
    queryKey: ['collection', id],
    queryFn: () => get<{ collection: CollectionDetail }>(`/collections/${id}`),
  });

  const collection = collectionData?.collection ?? null;

  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ['collection-documents', id],
    queryFn: () =>
      get<{ documents: Document[] }>(`/collections/${id}/documents`),
    refetchInterval: (query) => {
      const docs = query.state.data?.documents ?? [];
      const hasProcessing = docs.some((d) =>
        ['pending', 'chunking', 'embedding'].includes(d.status),
      );
      return hasProcessing ? 5000 : false;
    },
  });

  const documents = docsData?.documents ?? [];

  const handleUpload = useCallback(
    async (file: File) => {
      setUploadError('');
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('collection_id', id);
        await uploadFile('/documents', formData);
        void queryClient.invalidateQueries({
          queryKey: ['collection-documents', id],
        });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [id, queryClient],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleUpload(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [handleUpload],
  );

  const handleDelete = useCallback(
    async (docId: string) => {
      const prev = queryClient.getQueryData<{ documents: Document[] }>([
        'collection-documents',
        id,
      ]);
      queryClient.setQueryData<{ documents: Document[] }>(
        ['collection-documents', id],
        (old) => ({
          documents: (old?.documents ?? []).filter((d) => d.id !== docId),
        }),
      );
      try {
        await del(`/documents/${docId}`);
      } catch {
        queryClient.setQueryData(['collection-documents', id], prev);
      }
    },
    [id, queryClient],
  );

  const handleOverride = useCallback(
    async (docId: string) => {
      try {
        await post(`/documents/${docId}/override`);
        void queryClient.invalidateQueries({
          queryKey: ['collection-documents', id],
        });
      } catch {
        // silent fail — will show on next poll
      }
    },
    [id, queryClient],
  );

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'failed':
        return 'Failed';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Processing';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'ready':
        return styles.statusReady;
      case 'failed':
        return styles.statusFailed;
      case 'rejected':
        return styles.statusRejected;
      default:
        return styles.statusProcessing;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (collectionLoading) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading collection...</p>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Collection not found.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href='/dashboard' className={styles.backLink}>
          Back to Flight Plans
        </Link>
        <h1 className={styles.title}>{collection.name}</h1>
        {collection.description && (
          <p className={styles.description}>{collection.description}</p>
        )}
        {collection.is_demo && (
          <div className={styles.demoBanner} role='status'>
            Demo Collection &mdash; read-only, no uploads allowed
          </div>
        )}
      </header>

      <div className={styles.actions}>
        <input
          ref={fileInputRef}
          type='file'
          accept='.pdf,.docx,.txt,.md,.html'
          aria-label='Upload document'
          onChange={handleFileChange}
          hidden
        />
        <button
          className={styles.uploadButton}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || collection.is_demo}
          aria-label='Upload a document'
        >
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
        <button
          className={styles.chatButton}
          onClick={() => router.push(`/chat/${id}`)}
          aria-label='Start chatting about this collection'
        >
          Start Chatting
        </button>
        {uploadError && (
          <span className={styles.uploadError}>{uploadError}</span>
        )}
      </div>

      {docsLoading ? (
        <p className={styles.loading}>Loading documents...</p>
      ) : documents.length === 0 ? (
        <div className={styles.emptyState}>
          <Captain
            pose='clipboard'
            size='md'
            alt='Captain PolicyPilot with clipboard'
          />
          <p className={styles.emptyText}>
            No documents yet. Upload one to get started!
          </p>
        </div>
      ) : (
        <div className={styles.documentList}>
          {documents.map((doc) => (
            <div key={doc.id} className={styles.documentCard}>
              <div className={styles.documentInfo}>
                <span className={styles.filename}>{doc.filename}</span>
                <span className={styles.meta}>
                  {formatSize(doc.size_bytes)}
                  {doc.total_chunks != null &&
                    ` \u00B7 ${doc.total_chunks} chunks`}
                </span>
              </div>
              <div className={styles.documentActions}>
                <span
                  className={`${styles.status} ${getStatusClass(doc.status)}`}
                >
                  {getStatusLabel(doc.status)}
                </span>

                {doc.status === 'failed' && doc.error && (
                  <span className={styles.errorMessage} title={doc.error}>
                    {doc.error}
                  </span>
                )}

                {doc.status === 'rejected' && (
                  <>
                    {doc.rejection_reason && (
                      <span
                        className={styles.errorMessage}
                        title={doc.rejection_reason}
                      >
                        {doc.rejection_reason}
                      </span>
                    )}
                    <button
                      className={styles.overrideButton}
                      onClick={() => handleOverride(doc.id)}
                      aria-label={`Override rejection for ${doc.filename}`}
                    >
                      Override &amp; Process
                    </button>
                  </>
                )}

                <button
                  className={styles.deleteButton}
                  onClick={() => handleDelete(doc.id)}
                  aria-label={`Delete ${doc.filename}`}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
