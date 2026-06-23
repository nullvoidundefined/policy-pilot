/**
 * Wires the /documents HTTP routes to their handlers; applies requireAuth globally,
 * configures multer memory storage for the upload route, and maps CRUD verbs to document handlers.
 */
import { MAX_UPLOAD_BYTES } from 'app/constants/uploadLimits.js';
import * as documentHandlers from 'app/handlers/documents/documents.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import express from 'express';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
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
