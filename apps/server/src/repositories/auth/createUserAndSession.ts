/** Creates a new user and an initial session in a single transaction, returning both. */
import { withTransaction } from 'app/database/pool.js';
import type { User } from 'app/schemas/auth.js';

import { createSession } from './createSession.js';
import { createUser } from './createUser.js';

export async function createUserAndSession(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
): Promise<{ user: User; sessionId: string }> {
  return withTransaction(async (client) => {
    const user = await createUser(email, password, firstName, lastName, client);
    const sessionId = await createSession(user.id, client);
    return { user, sessionId };
  });
}
