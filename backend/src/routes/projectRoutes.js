import { Router } from 'express';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';

/**
 * En production, l’IA publique est refusée sauf ALLOW_ANON_AI=true.
 */
function requireAuthForAiInProd() {
  return (req, _res, next) => {
    if (!config.isProd || process.env.ALLOW_ANON_AI === 'true') {
      return next();
    }
    if (req.user?.id) return next();
    return next(new AppError('Connexion requise pour la recherche IA', 401));
  };
}

function aiGate(
  optionalAuth,
  aiAnonymousRateLimiter,
  aiRateLimiter,
  aiAnonRedisQuota,
  aiRedisQuota
) {
  const noop = (_r, _s, n) => n();
  return [
    optionalAuth,
    requireAuthForAiInProd(),
    (req, res, next) => {
      if (req.user?.id) {
        return (aiRedisQuota || noop)(req, res, () => aiRateLimiter(req, res, next));
      }
      return (aiAnonRedisQuota || noop)(req, res, () =>
        aiAnonymousRateLimiter(req, res, next)
      );
    },
  ];
}

export function createProjectRoutes({
  projectController,
  documentController,
  documentScanController,
  projectStageController,
  authenticate,
  optionalAuth,
  requirePaid,
  aiRateLimiter,
  aiAnonymousRateLimiter,
  documentScanRateLimiter,
  aiRedisQuota,
  aiAnonRedisQuota,
  scanRedisQuota,
  uploadDocument,
  uploadRateLimiter,
  uploadRedisQuota,
  previewTextRateLimiter,
  previewTextRedisQuota,
}) {
  const noop = (_r, _s, n) => n();
  const uploadGate = (req, res, next) =>
    (uploadRedisQuota || noop)(req, res, () => uploadRateLimiter(req, res, next));
  const previewGate = (req, res, next) =>
    (previewTextRedisQuota || noop)(req, res, () => previewTextRateLimiter(req, res, next));
  const router = Router();
  const publicAi = aiGate(
    optionalAuth,
    aiAnonymousRateLimiter,
    aiRateLimiter,
    aiAnonRedisQuota,
    aiRedisQuota
  );

  router.post('/preview', ...publicAi, projectController.preview);
  router.get('/locations/suggest', optionalAuth, projectController.suggestLocations);
  router.post('/search/businesses', ...publicAi, projectController.searchBusinesses);
  router.post('/search/trainings', ...publicAi, projectController.searchTrainings);
  router.post('/search/locations', ...publicAi, projectController.searchLocations);
  router.post('/search/proposals', ...publicAi, projectController.buildProposals);

  const paidAi = [
    authenticate,
    requirePaid,
    aiRedisQuota || ((_r, _s, n) => n()),
    aiRateLimiter,
  ];

  router.post('/', ...paidAi, projectController.create);
  router.get('/mine', authenticate, requirePaid, projectController.getMine);
  router.post('/mine/memory/situation', ...paidAi, projectController.recallSituation);
  router.post('/mine/memory/scan', ...paidAi, projectController.scanMemory);
  router.get('/mine/timeline', authenticate, requirePaid, projectController.getTimeline);

  router.get('/:id', authenticate, requirePaid, projectController.getOne);
  router.patch('/:id', authenticate, requirePaid, projectController.update);
  router.put('/:id/location', authenticate, requirePaid, projectController.updateLocation);
  router.post('/:id/memory/situation', ...paidAi, projectController.recallSituationForProject);
  router.post('/:id/memory/scan', ...paidAi, projectController.scanMemoryForProject);
  router.get('/:id/timeline', authenticate, requirePaid, projectController.getTimelineForProject);

  router.get('/:id/stages/:stage', authenticate, requirePaid, projectStageController.getOrCreate);
  router.patch('/:id/stages/:stage/tasks/:taskId', authenticate, requirePaid, projectStageController.updateTask);
  router.post('/:id/stages/:stage/links', authenticate, requirePaid, projectStageController.addLink);
  router.delete('/:id/stages/:stage/links/:linkId', authenticate, requirePaid, projectStageController.removeLink);
  router.post('/:id/stages/:stage/contacts', authenticate, requirePaid, projectStageController.createContact);
  router.patch('/:id/stages/:stage/milestones/:milestoneId', authenticate, requirePaid, projectStageController.updateMilestone);

  router.get('/:id/resources', authenticate, requirePaid, documentController.listResources);
  router.get('/:id/resource-categories', authenticate, requirePaid, documentController.listCategories);
  router.get('/:id/documents', authenticate, requirePaid, documentController.list);
  router.post(
    '/:id/documents',
    authenticate,
    requirePaid,
    uploadGate,
    uploadDocument,
    documentController.upload
  );
  router.get('/:id/documents/:docId', authenticate, requirePaid, documentController.getOne);
  router.patch('/:id/documents/:docId', authenticate, requirePaid, documentController.update);
  router.get(
    '/:id/documents/:docId/preview-text',
    authenticate,
    requirePaid,
    previewGate,
    documentController.textPreview
  );
  router.post('/:id/documents/:docId/contacts', authenticate, requirePaid, documentController.linkContact);
  router.delete('/:id/documents/:docId/contacts/:contactId', authenticate, requirePaid, documentController.unlinkContact);
  router.get('/:id/documents/:docId/download', authenticate, requirePaid, documentController.download);
  router.delete('/:id/documents/:docId', authenticate, requirePaid, documentController.remove);

  router.get('/:id/documents/:docId/scans/latest', authenticate, requirePaid, documentScanController.getLatest);
  router.post(
    '/:id/documents/:docId/scans',
    authenticate,
    requirePaid,
    scanRedisQuota || ((_r, _s, n) => n()),
    documentScanRateLimiter,
    documentScanController.retry
  );
  router.get('/:id/scans/:scanId', authenticate, requirePaid, documentScanController.getOne);
  router.post('/:id/scans/:scanId/apply', authenticate, requirePaid, documentScanController.apply);
  router.post('/:id/scans/:scanId/dismiss', authenticate, requirePaid, documentScanController.dismiss);

  return router;
}
