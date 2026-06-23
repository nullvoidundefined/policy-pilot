/**
 * Handles list and message-fetch operations for conversations - validates the
 * conversation ID, enforces ownership/presence, and delegates persistence to the
 * conversations repository so the routes only wire verbs to handlers (R-224).
 */
import { ApiError } from 'app/errors/ApiError.js';
import * as convRepo from 'app/repositories/conversations/index.js';
import type { Request, Response } from 'express';

export async function listConversations(
  req: Request,
  res: Response,
): Promise<void> {
  const conversations = await convRepo.listConversations(req.user!.id);
  res.json({ conversations });
}

export async function getConversationMessages(
  req: Request,
  res: Response,
): Promise<void> {
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
}
