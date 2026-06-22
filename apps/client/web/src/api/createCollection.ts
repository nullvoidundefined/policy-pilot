/** Creates a collection via the policy-pilot backend. */
import { post } from '@/api/request';

export function createCollection(name: string, description?: string) {
  return post<{ collection: any }>('/collections', { name, description });
}
