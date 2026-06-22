/** Deletes a collection via the policy-pilot backend. */
import { del } from '@/api/request';

export function deleteCollection(id: string) {
  return del<void>(`/collections/${id}`);
}
