/**
 * Updates a document's status and optionally total_chunks or error fields.
 */
import type { DocumentStatus } from '@repo/types';
import { query } from 'app/database/query.js';

export async function updateDocumentStatus(
  documentId: string,
  status: DocumentStatus,
  extra?: { total_chunks?: number; error?: string },
): Promise<void> {
  const sets = ['status = $2'];
  const values: unknown[] = [documentId, status];
  let idx = 3;

  if (extra?.total_chunks !== undefined) {
    sets.push(`total_chunks = $${idx}`);
    values.push(extra.total_chunks);
    idx++;
  }
  if (extra?.error !== undefined) {
    sets.push(`error = $${idx}`);
    values.push(extra.error);
    idx++;
  }

  await query(`UPDATE documents SET ${sets.join(', ')} WHERE id = $1`, values);
}
