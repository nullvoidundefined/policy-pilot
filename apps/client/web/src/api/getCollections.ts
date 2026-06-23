/** Fetches the current user's collections from the policy-pilot backend. */
import { get } from '@/api/request';

export function getCollections() {
  return get<{ collections: any[] }>('/collections');
}
