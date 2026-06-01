import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import * as convRepo from 'app/repositories/conversations/conversations.js';
import { ApiError } from 'app/utils/ApiError.js';
import express from 'express';
import type { Request, Response } from 'express';

const conversationRouter = express.Router();

conversationRouter.use(requireAuth);

conversationRouter.get('/', async (req: Request, res: Response) => {
  const conversations = await convRepo.listConversations(req.user!.id);
  res.json({ conversations });
});

conversationRouter.get('/:id/messages', async (req: Request, res: Response) => {
  const id = req.params.id as string | undefined;
  if (!id) {
    throw ApiError.badRequest('Conversation ID required');
  }

  const conversation = await convRepo.getConversation(id, req.user!.id);
  if (!conversation) {
    throw ApiError.notFound('Conversation not found');
  }

  const messages = await convRepo.getMessages(id);
  res.json({ conversation, messages });
});

export { conversationRouter };
