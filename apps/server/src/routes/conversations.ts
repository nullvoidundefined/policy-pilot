/**
 * Wires the /conversations HTTP routes to their handlers; gates all routes behind
 * requireAuth and delegates each verb to the conversations handler (R-224).
 */
import * as conversationHandlers from 'app/handlers/conversations/conversations.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import express from 'express';

const conversationRouter = express.Router();

conversationRouter.use(requireAuth);
conversationRouter.get('/', conversationHandlers.listConversations);
conversationRouter.get(
  '/:id/messages',
  conversationHandlers.getConversationMessages,
);

export { conversationRouter };
