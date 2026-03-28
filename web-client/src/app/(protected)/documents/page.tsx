'use client';

import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { del, get, uploadFile } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import styles from './documents.module.scss';

interface Document {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  total_chunks: number | null;
  error: string | null;
  created_at: string;
}

export default function DocumentsPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => get<{ documents: Document[] }>('/documents'),
    refetchInterval: 5000,
  });

  const documents = data?.documents ?? [];

  const handleUpload = useCallback(
    async (file: File) => {
      setUploadError('');
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        await uploadFile('/documents', formData);
        queryClient.invalidateQueries({ queryKey: ['documents'] });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [queryClient],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleUpload(file);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        handleUpload(file);
      }
    },
    [handleUpload],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await del(`/documents/${id}`);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    [queryClient],
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusClass = (status: string) => {
    switch (status) {
      case 'ready':
        return styles.statusReady;
      case 'failed':
        return styles.statusFailed;
      default:
        return styles.statusProcessing;
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Documents</h1>
        <div className={styles.headerActions}>
          <a href='/chat' className={styles.chatLink}>
            Ask a Question
          </a>
          <button className={styles.logoutButton} onClick={() => logout()}>
            Log Out
          </button>
        </div>
      </header>

      <div
        className={`${styles.dropzone} ${uploading ? styles.dropzoneActive : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type='file'
          accept='.pdf,.txt,.md'
          onChange={handleFileChange}
          hidden
        />
        <p className={styles.dropzoneText}>
          {uploading ? 'Uploading...' : 'Drop a file here or click to upload'}
        </p>
        <p className={styles.dropzoneHint}>PDF, TXT, or Markdown up to 10MB</p>
      </div>

      {uploadError && <p className={styles.error}>{uploadError}</p>}

      {isLoading ? (
        <p className={styles.emptyState}>Loading documents...</p>
      ) : documents.length === 0 ? (
        <p className={styles.emptyState}>
          No documents yet. Upload one to get started.
        </p>
      ) : (
        <div className={styles.documentList}>
          {documents.map((doc) => (
            <div key={doc.id} className={styles.documentCard}>
              <div className={styles.documentInfo}>
                <span className={styles.filename}>{doc.filename}</span>
                <span className={styles.meta}>
                  {formatSize(doc.size_bytes)}
                  {doc.total_chunks != null && ` · ${doc.total_chunks} chunks`}
                </span>
              </div>
              <div className={styles.documentActions}>
                <span className={`${styles.status} ${statusClass(doc.status)}`}>
                  {doc.status}
                </span>
                <button
                  className={styles.deleteButton}
                  onClick={() => handleDelete(doc.id)}
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
