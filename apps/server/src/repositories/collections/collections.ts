import { query } from 'app/db/pool/pool.js';
import type { Collection } from 'policy-pilot-common';

export async function createCollection(
  userId: string,
  name: string,
  description?: string,
): Promise<Collection> {
  const result = await query<Collection>(
    `INSERT INTO collections (user_id, name, description)
     VALUES ($1, $2, $3) RETURNING *`,
    [userId, name, description ?? null],
  );
  return result.rows[0]!;
}

export async function listCollections(userId: string): Promise<Collection[]> {
  const result = await query<Collection>(
    `SELECT * FROM collections
     WHERE user_id = $1 OR is_demo = true
     ORDER BY is_demo DESC, created_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function getCollectionById(
  id: string,
  userId: string,
): Promise<Collection | null> {
  const result = await query<Collection>(
    `SELECT * FROM collections
     WHERE id = $1 AND (user_id = $2 OR is_demo = true)`,
    [id, userId],
  );
  return result.rows[0] ?? null;
}

export async function getDemoCollection(): Promise<Collection | null> {
  const result = await query<Collection>(
    `SELECT * FROM collections WHERE is_demo = true LIMIT 1`,
  );
  return result.rows[0] ?? null;
}

export async function getDemoCollections(): Promise<Collection[]> {
  const result = await query<Collection>(
    `SELECT * FROM collections WHERE is_demo = true ORDER BY name`,
  );
  return result.rows;
}

export async function deleteCollection(
  id: string,
  userId: string,
): Promise<boolean> {
  const result = await query(
    `DELETE FROM collections WHERE id = $1 AND user_id = $2 AND is_demo = false RETURNING id`,
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getCollectionDocumentCount(id: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM documents WHERE collection_id = $1`,
    [id],
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}
