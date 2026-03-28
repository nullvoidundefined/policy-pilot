import * as documentHandlers from 'app/handlers/documents/documents.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import express from 'express';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const documentRouter = express.Router();

documentRouter.use(requireAuth);
documentRouter.post(
  '/',
  upload.single('file'),
  documentHandlers.uploadDocument,
);
documentRouter.get('/', documentHandlers.listDocuments);
documentRouter.get('/:id', documentHandlers.getDocument);
documentRouter.delete('/:id', documentHandlers.deleteDocument);

export { documentRouter };
