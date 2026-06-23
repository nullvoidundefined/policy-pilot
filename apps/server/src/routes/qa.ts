/**
 * Wires the /qa HTTP route to the streamQA handler; applies chatLimiter and
 * optionalAuth so unauthenticated users can query demo collections under rate limits.
 */
import * as qaHandlers from 'app/handlers/qa/qa.js';
import { chatLimiter } from 'app/middleware/rateLimiter/rateLimiter.js';
import { optionalAuth } from 'app/middleware/requireAuth/optionalAuth.js';
import express from 'express';

const qaRouter = express.Router();

qaRouter.post('/', chatLimiter, optionalAuth, qaHandlers.streamQA);

export { qaRouter };
