/**
 * Configures and exports the double-submit CSRF protection middleware and token generator,
 * tying CSRF secrets to the active session cookie so forged cross-origin requests are rejected.
 */
import { SESSION_COOKIE_NAME } from 'app/constants/session.js';
import { doubleCsrf } from 'csrf-csrf';
import type { Request } from 'express';

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET!,
  getSessionIdentifier: (req: Request) =>
    req.cookies?.[SESSION_COOKIE_NAME] ?? '',
  cookieName: '__csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    secure: process.env.NODE_ENV === 'production',
  },
});

export { doubleCsrfProtection as csrfGuard, generateCsrfToken };
