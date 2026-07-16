import { Router } from 'express';
import { ProjectController } from '../controllers/ProjectController.js';
import { DocumentController } from '../controllers/DocumentController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePaid } from '../middleware/requirePaid.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { uploadDocument } from '../middleware/upload.js';

const router = Router();

router.post('/preview', aiRateLimiter, ProjectController.preview);

// Parcours de recherche en 3 phases (public, comme l'aperçu).
router.post('/search/businesses', aiRateLimiter, ProjectController.searchBusinesses);
router.post('/search/locations', aiRateLimiter, ProjectController.searchLocations);
router.post('/search/proposals', aiRateLimiter, ProjectController.buildProposals);

router.post('/', aiRateLimiter, authenticate, requirePaid, ProjectController.create);
router.get('/mine', authenticate, requirePaid, ProjectController.getMine);

// Détail et cycle de vie d'un projet.
router.get('/:id', authenticate, requirePaid, ProjectController.getOne);
router.patch('/:id', authenticate, requirePaid, ProjectController.update);

// Documents rattachés à un projet.
router.get('/:id/documents', authenticate, requirePaid, DocumentController.list);
router.post('/:id/documents', authenticate, requirePaid, uploadDocument, DocumentController.upload);
router.get('/:id/documents/:docId/download', authenticate, requirePaid, DocumentController.download);
router.delete('/:id/documents/:docId', authenticate, requirePaid, DocumentController.remove);

export default router;
