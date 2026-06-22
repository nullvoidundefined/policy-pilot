/** Worker-side document write: updates a document's processing status and optional chunk-count/error fields. */
import { query } from 'app/database/pool.js';

interface StatusFields {
  error?: string;
  total_chunks?: number;
}

export async function updateDocumentStatus(
  documentId: string,
  status: string,
  extra?: StatusFields,
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
