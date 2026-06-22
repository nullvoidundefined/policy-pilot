/** Deletes a non-demo collection owned by the user; returns true if a row was removed. */
import { query } from 'app/database/pool.js';

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
