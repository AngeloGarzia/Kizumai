import { AppError } from '../utils/AppError.js';
import { withAiUsageContext } from '../utils/aiUsage.js';
import {
  hashFingerprint,
  makeProposalKey,
} from '../repositories/ProjectAuditRepository.js';

const FIELD_LABELS = {
  business: 'Business / activité',
  location: 'Lieu',
  budget: 'Budget',
  title: 'Titre',
  description: 'Description',
};
const FIELD_KEYS = new Set(Object.keys(FIELD_LABELS));
const ACTION_KINDS = new Set(['deadline', 'document', 'task', 'alternative', 'contact']);
const PRIORITIES = new Set(['high', 'medium', 'low']);

function clip(value, max) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function normalizeConfidence(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return Math.min(1, Math.max(0, n));
}

function valuesDiffer(a, b) {
  const left = String(a ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const right = String(b ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!right) return false;
  return left !== right;
}

/**
 * Audit expert forcé : viabilité + rentabilité + propositions (cadrage + actions).
 * Les refus sont mémorisés tant que le fingerprint contexte projet est inchangé.
 */
export function createProjectAuditService({
  projectAuditRepository,
  projectRepository,
  documentRepository,
  documentScanRepository = null,
  companyRepository = null,
  plannerEventRepository = null,
  activityRepository,
  locationRepository,
  currencyService,
  aiService,
  projectMemoryScanService = null,
  projectMemorySnapshotRepository = null,
  projectMemoryUpdateService = null,
}) {
  const running = new Set();

  async function hydrate(audit) {
    const items = await projectAuditRepository.listItems(audit.id);
    return { audit, items };
  }

  async function assertOwner(userId, projectId) {
    const project = await projectRepository.findById(projectId);
    if (!project || Number(project.userId) !== Number(userId)) {
      throw new AppError('Projet introuvable', 404);
    }
    return project;
  }

  async function buildContextFingerprint(project, extras = {}) {
    return hashFingerprint([
      project.quoi || project.activity?.label,
      project.ou || project.location?.label,
      project.budget,
      project.currency,
      project.stage,
      project.status,
      project.title,
      clip(project.description, 200),
      extras.docCount,
      extras.eventCount,
      clip(extras.memorySummary, 400),
    ]);
  }

  async function gatherExtras(project) {
    const projectId = project.id;
    const [snapshot, docs, company, events] = await Promise.all([
      projectMemorySnapshotRepository?.findByProjectId?.(projectId),
      documentRepository.findByProjectId(projectId),
      companyRepository?.findByProjectId?.(projectId),
      plannerEventRepository?.findByProjectId?.(projectId),
    ]);

    let memoryText = snapshot?.summary || '';
    if (snapshot) {
      memoryText = [
        snapshot.summary,
        Array.isArray(snapshot.keyFacts) && snapshot.keyFacts.length
          ? `Faits : ${snapshot.keyFacts.slice(0, 12).join(' · ')}`
          : null,
        Array.isArray(snapshot.activeBlockers) && snapshot.activeBlockers.length
          ? `Blocages : ${snapshot.activeBlockers.slice(0, 8).join(' · ')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n');
    }

    const docLines = [];
    for (const doc of (docs || []).slice(0, 15)) {
      let summary = clip(doc.excerpt || doc.description || '', 500);
      if (documentScanRepository?.findLatestForDocument) {
        try {
          const scan = await documentScanRepository.findLatestForDocument(doc.id);
          if (scan?.status === 'ready' && documentScanRepository.listItems) {
            const items = await documentScanRepository.listItems(scan.id);
            const accepted = items.find(
              (i) => i.itemType === 'summary' && i.status === 'accepted'
            );
            if (accepted?.payload?.text) summary = clip(accepted.payload.text, 800);
          }
        } catch {
          /* ignore */
        }
      }
      docLines.push(`- ${doc.title || doc.fileName}${summary ? ` : ${summary}` : ''}`);
    }

    const plannerLines = (events || [])
      .filter((e) => ['todo', 'in_progress'].includes(e.status))
      .slice(0, 15)
      .map(
        (e) =>
          `- [${e.kind}] ${e.title} @ ${e.startAt ? String(e.startAt).slice(0, 16) : '?'}`
      );

    return {
      title: project.title || '',
      business: project.quoi || project.activity?.label || '',
      location: project.ou || project.location?.label || '',
      budget: project.budget != null ? String(project.budget) : '',
      currency: project.currency || 'EUR',
      stage: project.stage || '',
      status: project.status || '',
      description: clip(project.description, 4000) || 'aucune',
      company: company
        ? [company.legalName || company.tradeName, company.legalForm]
            .filter(Boolean)
            .join(' · ')
        : 'aucune',
      memorySnapshot: memoryText || 'aucune',
      documents: docLines.join('\n') || 'aucun',
      planner: plannerLines.join('\n') || 'aucune',
      extras: `Nb docs=${(docs || []).length} · Nb échéances actives=${plannerLines.length}`,
      docCount: (docs || []).length,
      eventCount: (events || []).length,
      memorySummary: memoryText || '',
    };
  }

  function buildItemsFromAi(result, project, rejectedKeys) {
    const items = [];
    const current = {
      business: project.quoi || project.activity?.label || '',
      location: project.ou || project.location?.label || '',
      budget: project.budget != null ? String(Math.round(Number(project.budget))) : '',
      title: project.title || '',
      description: project.description || '',
    };

    for (const p of result.fieldProposals || []) {
      const field = String(p.field || '').trim().toLowerCase();
      if (!FIELD_KEYS.has(field)) continue;
      let proposed = clip(p.proposedValue, field === 'description' ? 4000 : 500);
      if (!proposed) continue;
      if (field === 'budget') {
        const n = Number(String(proposed).replace(/[^\d.-]/g, ''));
        if (!Number.isFinite(n) || n <= 0) continue;
        proposed = String(Math.round(n));
      }
      const currentValue = current[field] || clip(p.currentValue, 500) || '';
      if (!valuesDiffer(currentValue, proposed)) continue;

      const proposalKey = makeProposalKey({
        itemType: 'field',
        fieldKey: field,
        proposedValue: proposed,
      });
      if (rejectedKeys.has(proposalKey)) continue;

      items.push({
        itemType: 'field',
        fieldKey: field,
        priority: PRIORITIES.has(p.priority) ? p.priority : 'medium',
        confidence: normalizeConfidence(p.confidence),
        title: FIELD_LABELS[field],
        body: clip(p.rationale, 1200),
        currentValue: currentValue || null,
        proposedValue: proposed,
        rationale: clip(p.rationale, 1200),
        proposalKey,
        payload: {},
      });
    }

    for (const a of result.actionProposals || []) {
      const actionKind = String(a.actionKind || 'task').trim().toLowerCase();
      if (!ACTION_KINDS.has(actionKind)) continue;
      const title = clip(a.title, 255);
      if (!title) continue;
      const proposedValue = clip(a.proposedValue || a.body, 2000);
      const proposalKey = makeProposalKey({
        itemType: 'action',
        actionKind,
        title,
        proposedValue,
      });
      if (rejectedKeys.has(proposalKey)) continue;

      items.push({
        itemType: 'action',
        actionKind,
        priority: PRIORITIES.has(a.priority) ? a.priority : 'medium',
        confidence: null,
        title,
        body: clip(a.body, 2000),
        proposedValue,
        rationale: clip(a.rationale, 1200),
        proposalKey,
        payload: { url: a.urlHint || null },
      });
    }

    const order = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));
    return items.map((item, idx) => ({ ...item, sortOrder: idx }));
  }

  async function processAudit(auditId) {
    if (running.has(auditId)) return null;
    running.add(auditId);
    try {
      const audit = await projectAuditRepository.findById(auditId);
      if (!audit || ['ready', 'dismissed', 'applied'].includes(audit.status)) {
        return audit ? hydrate(audit) : null;
      }

      const project = await projectRepository.findById(audit.projectId);
      if (!project) {
        await projectAuditRepository.update(auditId, {
          status: 'failed',
          errorMessage: 'Projet introuvable',
          finishedAt: new Date().toISOString(),
        });
        return hydrate(await projectAuditRepository.findById(auditId));
      }

      if (projectMemoryScanService?.scanAndRebuild) {
        try {
          await projectMemoryScanService.scanAndRebuild(project.id);
        } catch (err) {
          console.warn('[audit] memory rebuild:', err.message);
        }
      }

      const ctx = await gatherExtras(project);
      const fingerprint = await buildContextFingerprint(project, ctx);
      const rejections = await projectAuditRepository.listActiveRejections(
        project.id,
        fingerprint
      );
      const rejectedKeys = new Set(rejections.map((r) => r.proposalKey));
      const rejectedText = rejections.length
        ? rejections
            .map((r) => `- ${r.title || r.proposalKey}: ${r.proposedValue || ''}`)
            .join('\n')
        : 'aucune';

      const result = await withAiUsageContext(
        {
          userId: audit.userId,
          projectId: project.id,
          purpose: 'project_audit',
        },
        () =>
          aiService.analyzeProjectAudit({
            ...ctx,
            rejected: rejectedText,
          })
      );

      const items = buildItemsFromAi(result, project, rejectedKeys);
      await projectAuditRepository.deleteItems(auditId);
      await projectAuditRepository.createItems(auditId, items);
      await projectAuditRepository.update(auditId, {
        status: 'ready',
        viabilitySummary: result.viabilitySummary || null,
        profitabilitySummary: result.profitabilitySummary || null,
        overallVerdict: result.overallVerdict || null,
        contextFingerprint: fingerprint,
        provider: result.provider || null,
        rawResponse: result.raw || {},
        finishedAt: new Date().toISOString(),
        errorMessage: null,
      });

      return hydrate(await projectAuditRepository.findById(auditId));
    } catch (err) {
      await projectAuditRepository.update(auditId, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        errorMessage: err.message || 'Audit impossible',
      });
      console.warn('[audit] process:', err.message);
      return hydrate(await projectAuditRepository.findById(auditId));
    } finally {
      running.delete(auditId);
    }
  }

  return {
    async startAudit(userId, projectId) {
      const project = await assertOwner(userId, projectId);
      const active = await projectAuditRepository.findLatestForProject(project.id, {
        statuses: ['pending', 'processing'],
      });
      if (active) return hydrate(active);

      const ctx = await gatherExtras(project);
      const fingerprint = await buildContextFingerprint(project, ctx);
      const audit = await projectAuditRepository.create({
        projectId: project.id,
        userId,
        contextFingerprint: fingerprint,
      });

      setImmediate(() => {
        processAudit(audit.id).catch((err) => {
          console.warn('[audit] enqueue:', err.message);
        });
      });

      return hydrate(audit);
    },

    async getAudit(userId, projectId, auditId) {
      await assertOwner(userId, projectId);
      const audit = await projectAuditRepository.findById(auditId);
      if (!audit || Number(audit.projectId) !== Number(projectId)) {
        throw new AppError('Audit introuvable', 404);
      }
      return hydrate(audit);
    },

    async getLatest(userId, projectId) {
      await assertOwner(userId, projectId);
      const audit = await projectAuditRepository.findLatestForProject(projectId);
      if (!audit) return null;
      return hydrate(audit);
    },

    async applyAudit(userId, projectId, auditId, { acceptItemIds = [], rejectItemIds = [] }) {
      await assertOwner(userId, projectId);
      const audit = await projectAuditRepository.findById(auditId);
      if (!audit || Number(audit.projectId) !== Number(projectId)) {
        throw new AppError('Audit introuvable', 404);
      }
      if (audit.status !== 'ready') {
        throw new AppError("L'audit n'est pas prêt", 400);
      }

      const acceptIds = [...new Set(acceptItemIds.map(Number).filter(Boolean))];
      const rejectIds = [...new Set(rejectItemIds.map(Number).filter(Boolean))];
      const fingerprint = audit.contextFingerprint || '';

      for (const id of rejectIds) {
        const items = await projectAuditRepository.findItemsByIds(auditId, [id]);
        const item = items[0];
        if (!item || item.status !== 'suggested') continue;
        await projectAuditRepository.updateItem(id, { status: 'rejected' });
        await projectAuditRepository.rememberRejection({
          projectId,
          proposalKey: item.proposalKey,
          contextFingerprint: fingerprint,
          title: item.title,
          proposedValue: item.proposedValue || item.body,
        });
      }

      const toAccept = await projectAuditRepository.findItemsByIds(auditId, acceptIds);
      let project = await projectRepository.findById(projectId);

      for (const item of toAccept) {
        if (item.status !== 'suggested') continue;

        if (item.itemType === 'field') {
          const value = clip(item.proposedValue, 4000);
          if (!value) continue;

          if (item.fieldKey === 'business') {
            const activity = await activityRepository.findOrCreate({ label: value });
            project = await projectRepository.setActivityId(projectId, activity.id);
          } else if (item.fieldKey === 'location') {
            const location = await locationRepository.findOrCreate({
              label: value,
              country: 'FR',
            });
            project = await projectRepository.setLocationId(projectId, location.id);
          } else if (item.fieldKey === 'budget') {
            const currency = project.currency || 'EUR';
            const clamped = await currencyService.clampBudget(Number(value), currency);
            project = await projectRepository.setBudget(projectId, clamped, currency);
          } else if (item.fieldKey === 'title') {
            project = await projectRepository.updateLifecycle(projectId, { title: value });
          } else if (item.fieldKey === 'description') {
            project = await projectRepository.updateLifecycle(projectId, {
              description: value,
            });
          }

          if (projectMemoryUpdateService) {
            projectMemoryUpdateService.recordEventSafe({
              projectId,
              nodeType: 'decision',
              content: `Audit Fabulous — ${item.title} accepté : ${value}${
                item.rationale ? ` — ${item.rationale}` : ''
              }`,
              sourceEntityType: 'project',
              sourceEntityId: projectId,
              importance: 0.88,
            });
          }
        }

        if (item.itemType === 'action') {
          // Action validée : mémorisée + échéance créée si deadline
          if (
            item.actionKind === 'deadline' &&
            plannerEventRepository?.create
          ) {
            try {
              const start = new Date();
              start.setDate(start.getDate() + 7);
              await plannerEventRepository.create({
                userId,
                projectId,
                kind: 'deadline',
                title: item.title,
                description: item.body || item.proposedValue || 'Issu de l’audit Fabulous',
                startAt: start.toISOString(),
                allDay: true,
                status: 'todo',
                color: '#e8722a',
                metadata: { source: 'project_audit', auditId },
              });
            } catch (err) {
              console.warn('[audit] create deadline:', err.message);
            }
          }

          if (projectMemoryUpdateService) {
            projectMemoryUpdateService.recordEventSafe({
              projectId,
              nodeType: 'decision',
              content: `Audit Fabulous — action acceptée [${item.actionKind}] ${item.title}${
                item.body ? ` : ${clip(item.body, 400)}` : ''
              }`,
              sourceEntityType: 'project',
              sourceEntityId: projectId,
              importance: 0.8,
            });
          }
        }

        await projectAuditRepository.updateItem(item.id, { status: 'accepted' });
      }

      await projectAuditRepository.update(auditId, { status: 'applied' });
      return {
        ...(await hydrate(await projectAuditRepository.findById(auditId))),
        project,
      };
    },

    async dismissAudit(userId, projectId, auditId) {
      await assertOwner(userId, projectId);
      const audit = await projectAuditRepository.findById(auditId);
      if (!audit || Number(audit.projectId) !== Number(projectId)) {
        throw new AppError('Audit introuvable', 404);
      }
      // Tout ce qui reste « suggested » est traité comme rejeté (mémoire contexte).
      const items = await projectAuditRepository.listItems(auditId);
      for (const item of items) {
        if (item.status !== 'suggested') continue;
        await projectAuditRepository.updateItem(item.id, { status: 'rejected' });
        await projectAuditRepository.rememberRejection({
          projectId,
          proposalKey: item.proposalKey,
          contextFingerprint: audit.contextFingerprint || '',
          title: item.title,
          proposedValue: item.proposedValue || item.body,
        });
      }
      await projectAuditRepository.update(auditId, { status: 'dismissed' });
      return hydrate(await projectAuditRepository.findById(auditId));
    },

    processAudit,
  };
}
