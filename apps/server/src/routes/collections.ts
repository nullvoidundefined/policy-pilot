import * as collectionHandlers from 'app/handlers/collections/collections.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import * as collectionsRepo from 'app/repositories/collections/collections.js';
import express from 'express';

const collectionRouter = express.Router();

// Public route — no auth required
collectionRouter.get('/demo', async (_req, res) => {
  const collections = await collectionsRepo.getDemoCollections();
  if (collections.length === 0) {
    res.status(404).json({ error: 'No demo collections available' });
    return;
  }
  res.json({ collections });
});

// Authenticated routes
collectionRouter.use(requireAuth);
collectionRouter.get('/', collectionHandlers.listCollections);
collectionRouter.post('/', collectionHandlers.createCollection);
collectionRouter.get('/:id', collectionHandlers.getCollection);
collectionRouter.delete('/:id', collectionHandlers.deleteCollection);

export { collectionRouter };
