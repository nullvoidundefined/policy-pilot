import * as collectionsRepo from 'app/repositories/collections/collections.js';
import { ApiError } from 'app/utils/ApiError.js';
import type { Request, Response } from 'express';

export async function createCollection(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user!;
  const { name, description } = req.body as {
    name?: string;
    description?: string;
  };

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw ApiError.badRequest('Collection name is required');
  }

  const collection = await collectionsRepo.createCollection(
    user.id,
    name.trim(),
    description,
  );
  res.status(201).json({ collection });
}

export async function listCollections(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user!;
  const collections = await collectionsRepo.listCollections(user.id);

  const withCounts = await Promise.all(
    collections.map(async (c) => ({
      ...c,
      document_count: await collectionsRepo.getCollectionDocumentCount(c.id),
    })),
  );

  res.json({ collections: withCounts });
}

export async function getCollection(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user!;
  const id = req.params.id as string;

  const collection = await collectionsRepo.getCollectionById(id, user.id);
  if (!collection) {
    throw ApiError.notFound('Collection not found');
  }

  const document_count = await collectionsRepo.getCollectionDocumentCount(id);
  res.json({ collection: { ...collection, document_count } });
}

export async function deleteCollection(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user!;
  const id = req.params.id as string;

  const deleted = await collectionsRepo.deleteCollection(id, user.id);
  if (!deleted) {
    throw ApiError.notFound('Collection not found or cannot be deleted');
  }

  res.status(204).send();
}
