import * as qaHandlers from 'app/handlers/qa/qa.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import express from 'express';

const qaRouter = express.Router();

qaRouter.use(requireAuth);
qaRouter.post('/', qaHandlers.streamQA);

export { qaRouter };
