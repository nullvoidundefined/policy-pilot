import * as qaHandlers from 'app/handlers/qa/qa.js';
import { chatLimiter } from 'app/middleware/rateLimiter/rateLimiter.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import express from 'express';

const qaRouter = express.Router();

qaRouter.use(requireAuth);
qaRouter.post('/', chatLimiter, qaHandlers.streamQA);

export { qaRouter };
