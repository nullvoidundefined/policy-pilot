import * as qaHandlers from 'app/handlers/qa/qa.js';
import { chatLimiter } from 'app/middleware/rateLimiter/rateLimiter.js';
import { optionalAuth } from 'app/middleware/requireAuth/requireAuth.js';
import express from 'express';

const qaRouter = express.Router();

qaRouter.post('/', chatLimiter, optionalAuth, qaHandlers.streamQA);

export { qaRouter };
