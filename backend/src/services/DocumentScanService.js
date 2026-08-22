import { readFile } from 'fs/promises';
import { AppError } from '../utils/AppError.js';
import { withTempFile } from '../utils/tempFile.js';
import { enqueueDocumentScan } from '../queue/documentQueue.js';
import {
  extractDocumentText,
  SUPPORTED_EXTRACT_HINT,
} from './DocumentTextExtractor.js';

const DATE_KINDS = new Set(['deadline', 'appointment', 'task', 'reminder']);

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

function parseIsoDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function createDocumentScanService({
  documentScanRepository,
  documentRepository,
  projectRepository,
  contactRepository,
  contactLinkRepository,
  plannerEventRepository,
  locationRepository,
  storageService,
  aiService,
  projectMemoryUpdateService = null,
  projectMemoryRecallService = null,
}) {
  async function loadDocumentBuffer(doc) {
    const row = await documentRepository.findContentById(doc.id);
    if (row?.content?.length) return row.content;

    if (doc.storageKey) {
      try {
        const abs = storageService.absolutePath(doc.storageKey);
        const buf = await readFile(abs);
        if (buf?.length) {
          await documentRepository.updateContent(doc.id, buf, buf.length).catch(() => {});
          return buf;
        }
      } catch {
        /* ignore */
      }
    }

    throw new AppError('Contenu du fichier introuvable en base', 404);
  }
  async function assertProjectOwner(userId, projectId) {
    const project = await projectRepository.findById(projectId);
    if (!project || project.userId !== Number(userId)) {
      throw new AppError('Projet introuvable', 404);
    }
    return project;
  }

  async function hydrateScan(scan) {
    const items = await documentScanRepository.listItems(scan.id);
    const document = await documentRepository.findById(scan.documentId);
    return {
      scan: {
        ...scan,
        rawResponse: undefined,
        errorMessage: scan.status === 'failed' ? 'Analyse indisponible' : undefined,
      },
      document,
      items,
      summary: {
        contacts: items.filter((i) => i.itemType === 'contact').length,
        dates: items.filter((i) => i.itemType === 'date').length,
        addresses: items.filter((i) => i.itemType === 'address').length,
        suggested: items.filter((i) => i.status === 'suggested').length,
      },
    };
  }

  async function matchContact(userId, payload) {
    const contacts = await contactRepository.findByUserId(userId);
    const email = clip(payload.email, 255)?.toLowerCase();
    const phone = clip(payload.phone, 40)?.replace(/\s+/g, '');
    if (email) {
      const hit = contacts.find((c) => c.email?.toLowerCase() === email);
      if (hit) return hit;
    }
    if (phone) {
      const hit = contacts.find((c) => (c.phone || c.mobile || '').replace(/\s+/g, '') === phone);
      if (hit) return hit;
    }
    return null;
  }

  function buildItemsFromAi(result) {
    const items = [];

    for (const c of (result.contacts || []).slice(0, 40)) {
      const displayName = clip(c.displayName || c.name, 200);
      if (!displayName) continue;
      items.push({
        itemType: 'contact',
        confidence: normalizeConfidence(c.confidence),
        label: displayName,
        payload: {
          displayName,
          email: clip(c.email, 255),
          phone: clip(c.phone, 40),
          organization: clip(c.organization, 200),
          jobTitle: clip(c.jobTitle, 120),
          roleHint: clip(c.roleHint, 80) || 'lié',
          snippet: clip(c.snippet, 500),
        },
      });
    }

    for (const d of (result.dates || []).slice(0, 40)) {
      const title = clip(d.title, 255);
      const startAt = parseIsoDate(d.startAt);
      if (!title || !startAt) continue;
      const kind = DATE_KINDS.has(d.kind) ? d.kind : 'deadline';
      items.push({
        itemType: 'date',
        confidence: normalizeConfidence(d.confidence),
        label: title,
        payload: {
          title,
          startAt,
          endAt: parseIsoDate(d.endAt),
          allDay: d.allDay !== false,
          kind,
          snippet: clip(d.snippet, 500),
        },
      });
    }

    for (const a of (result.addresses || []).slice(0, 40)) {
      const city = clip(a.city, 120);
      const line1 = clip(a.addressLine1, 255);
      const label = clip(a.label, 200) || [line1, city].filter(Boolean).join(', ');
      if (!label && !city) continue;
      items.push({
        itemType: 'address',
        confidence: normalizeConfidence(a.confidence),
        label: label || city,
        payload: {
          label: label || city,
          addressLine1: line1,
          postalCode: clip(a.postalCode, 16),
          city,
          country: clip(a.country, 2) || 'FR',
          snippet: clip(a.snippet, 500),
        },
      });
    }

    return items;
  }

  return {
    async startScan({ userId, projectId, documentId }) {
      await assertProjectOwner(userId, projectId);
      const doc = await documentRepository.findById(documentId);
      if (!doc || doc.projectId !== Number(projectId)) {
        throw new AppError('Document introuvable', 404);
      }

      const scan = await documentScanRepository.create({
        documentId,
        projectId,
        userId,
        promptKey: 'document_scan',
      });

      await enqueueDocumentScan({ scanId: scan.id }).catch((err) => {
        console.warn(`[document-scan] enqueue scan #${scan.id} :`, err.message);
      });

      return scan;
    },

    async processScan(scanId) {
      const scan = await documentScanRepository.findById(scanId);
      if (!scan) return null;
      if (['ready', 'dismissed'].includes(scan.status)) return hydrateScan(scan);

      await documentScanRepository.update(scanId, {
        status: 'processing',
        startedAt: new Date().toISOString(),
        errorMessage: null,
      });

      try {
        const doc = await documentRepository.findById(scan.documentId);
        if (!doc) throw new AppError('Document introuvable', 404);

        let text = String(doc.excerpt || '').trim();
        if (!text) {
          const buffer = await loadDocumentBuffer(doc);
          text = await withTempFile(buffer, doc.fileName || 'file.bin', async (abs) =>
            extractDocumentText(abs, {
              mimeType: doc.mimeType,
              fileName: doc.fileName || doc.title,
            })
          );
        }

        if (!text.trim()) {
          await documentScanRepository.deleteSuggestedItems(scanId);
          await documentScanRepository.update(scanId, {
            status: 'failed',
            finishedAt: new Date().toISOString(),
            rawTextExcerpt: null,
            errorMessage:
              `Aucun texte extractible. ${SUPPORTED_EXTRACT_HINT}`,
          });
          return hydrateScan(await documentScanRepository.findById(scanId));
        }

        let memoryContext = '';
        if (projectMemoryRecallService?.buildRecallContext) {
          try {
            const ctx = await projectMemoryRecallService.buildRecallContext(
              scan.projectId,
              `Analyse du document « ${doc.title || doc.fileName} »`,
              { maxChars: 2500, limit: 10 }
            );
            memoryContext = ctx?.text || '';
          } catch {
            memoryContext = '';
          }
        }

        const result = await aiService.analyzeDocumentExtract({
          documentTitle: doc.title || doc.fileName,
          mimeType: doc.mimeType,
          text,
          memoryContext,
        });

        let items = buildItemsFromAi(result);
        for (const item of items) {
          if (item.itemType === 'contact') {
            const matched = await matchContact(scan.userId, item.payload);
            if (matched) {
              item.matchedEntityType = 'contact';
              item.matchedEntityId = matched.id;
            }
          }
        }

        await documentScanRepository.deleteSuggestedItems(scanId);
        await documentScanRepository.createItems(scanId, items);
        await documentScanRepository.update(scanId, {
          status: 'ready',
          provider: result.provider,
          rawTextExcerpt: text.slice(0, 4000),
          rawResponse: result.raw || {},
          finishedAt: new Date().toISOString(),
          errorMessage: null,
        });

        // Mettre à jour excerpt document si vide
        if (!doc.excerpt && text.trim()) {
          await documentRepository.update(doc.id, { excerpt: text.slice(0, 2000) });
        }

        if (projectMemoryUpdateService) {
          const itemSummary = items
            .slice(0, 10)
            .map((i) => `${i.itemType}: ${i.label || ''}`.trim())
            .filter(Boolean)
            .join(' · ');
          projectMemoryUpdateService.recordEventSafe({
            projectId: scan.projectId,
            nodeType: 'insight',
            content: [
              `Analyse IA document « ${doc.title || doc.fileName} »`,
              items.length ? `${items.length} élément(s) détecté(s)` : null,
              itemSummary || null,
              `extrait : ${text.slice(0, 1500)}`,
            ]
              .filter(Boolean)
              .join(' — '),
            sourceEntityType: 'document_scan',
            sourceEntityId: scan.id,
            importance: 0.72,
          });
          // Enrichit aussi le nœud document avec l'extrait
          projectMemoryUpdateService.recordEventSafe({
            projectId: scan.projectId,
            nodeType: 'fact',
            content: [
              `Document : ${doc.title || doc.fileName}`,
              doc.type ? `type ${doc.type}` : null,
              `extrait : ${text.slice(0, 1800)}`,
            ]
              .filter(Boolean)
              .join(' — '),
            sourceEntityType: 'document',
            sourceEntityId: doc.id,
            importance: 0.68,
          });
        }

        return hydrateScan(await documentScanRepository.findById(scanId));
      } catch (err) {
        await documentScanRepository.update(scanId, {
          status: 'failed',
          finishedAt: new Date().toISOString(),
          errorMessage: err.message || 'Échec du scan IA',
        });
        throw err;
      }
    },

    async getScan(userId, projectId, scanId) {
      await assertProjectOwner(userId, projectId);
      const scan = await documentScanRepository.findById(scanId);
      if (!scan || scan.projectId !== Number(projectId)) {
        throw new AppError('Scan introuvable', 404);
      }
      return hydrateScan(scan);
    },

    async getLatestForDocument(userId, projectId, documentId) {
      await assertProjectOwner(userId, projectId);
      const doc = await documentRepository.findById(documentId);
      if (!doc || doc.projectId !== Number(projectId)) {
        throw new AppError('Document introuvable', 404);
      }
      const scan = await documentScanRepository.findLatestForDocument(documentId);
      if (!scan) return null;
      return hydrateScan(scan);
    },

    async applyScan(userId, projectId, scanId, { acceptItemIds = [], rejectItemIds = [], edits = {} }) {
      await assertProjectOwner(userId, projectId);
      const scan = await documentScanRepository.findById(scanId);
      if (!scan || scan.projectId !== Number(projectId)) {
        throw new AppError('Scan introuvable', 404);
      }
      if (scan.status !== 'ready') {
        throw new AppError('Le scan n\'est pas prêt', 400);
      }

      const acceptIds = [...new Set(acceptItemIds.map(Number).filter(Boolean))];
      const rejectIds = [...new Set(rejectItemIds.map(Number).filter(Boolean))];

      for (const id of rejectIds) {
        const items = await documentScanRepository.findItemsByIds(scanId, [id]);
        if (items[0]?.status === 'suggested') {
          await documentScanRepository.updateItem(id, { status: 'rejected' });
        }
      }

      const toAccept = await documentScanRepository.findItemsByIds(scanId, acceptIds);

      for (const item of toAccept) {
        if (item.status !== 'suggested') continue;
        const edit = edits[String(item.id)] || edits[item.id] || {};
        const payload = { ...item.payload, ...edit };

        if (item.itemType === 'contact') {
          let contactId = item.matchedEntityId;
          if (!contactId) {
            const created = await contactRepository.create({
              userId,
              projectId,
              contactType: 'person',
              category: 'autre',
              displayName: clip(payload.displayName, 200),
              email: clip(payload.email, 255),
              phone: clip(payload.phone, 40),
              organization: clip(payload.organization, 200),
              jobTitle: clip(payload.jobTitle, 120),
              source: 'document_scan',
              notes: payload.snippet ? `Extrait doc : ${payload.snippet}` : null,
            });
            contactId = created.id;
          }
          await contactLinkRepository.link({
            contactId,
            entityType: 'document',
            entityId: scan.documentId,
            role: clip(payload.roleHint, 80) || 'lié',
          });
          await documentScanRepository.updateItem(item.id, {
            status: item.matchedEntityId ? 'merged' : 'accepted',
            createdEntityType: 'contact',
            createdEntityId: contactId,
            payload,
          });
          if (projectMemoryUpdateService) {
            projectMemoryUpdateService.recordEventSafe({
              projectId,
              nodeType: 'fact',
              content: [
                'Contact extrait du document',
                payload.displayName || payload.organization,
                payload.organization,
                payload.email,
                payload.jobTitle,
              ]
                .filter(Boolean)
                .join(' — '),
              sourceEntityType: 'contact',
              sourceEntityId: contactId,
              importance: 0.62,
            });
          }
        }

        if (item.itemType === 'date') {
          const startAt = parseIsoDate(payload.startAt);
          if (!startAt) continue;
          const event = await plannerEventRepository.create({
            userId,
            projectId,
            kind: DATE_KINDS.has(payload.kind) ? payload.kind : 'deadline',
            title: clip(payload.title, 255) || item.label,
            description: payload.snippet || `Issu du document #${scan.documentId}`,
            startAt,
            endAt: parseIsoDate(payload.endAt),
            allDay: payload.allDay !== false,
            status: 'todo',
            color: '#e8722a',
            metadata: { source: 'document_scan', scanId, documentId: scan.documentId },
          });
          await documentScanRepository.updateItem(item.id, {
            status: 'accepted',
            createdEntityType: 'planner_event',
            createdEntityId: event.id,
            payload,
          });
          if (projectMemoryUpdateService) {
            projectMemoryUpdateService.recordEventSafe({
              projectId,
              nodeType: 'event',
              content: [
                'Échéance extraite du document',
                event.title,
                payload.kind || 'deadline',
                startAt.slice(0, 10),
              ]
                .filter(Boolean)
                .join(' — '),
              sourceEntityType: 'planner_event',
              sourceEntityId: event.id,
              importance: 0.65,
            });
          }
        }

        if (item.itemType === 'address') {
          const location = await locationRepository.findOrCreate({
            label: clip(payload.label, 200) || 'Adresse document',
            addressLine1: clip(payload.addressLine1, 255),
            postalCode: clip(payload.postalCode, 16),
            city: clip(payload.city, 120),
            country: clip(payload.country, 2) || 'FR',
          });
          await documentScanRepository.updateItem(item.id, {
            status: 'accepted',
            createdEntityType: 'location',
            createdEntityId: location.id,
            payload,
          });
          if (projectMemoryUpdateService) {
            projectMemoryUpdateService.recordEventSafe({
              projectId,
              nodeType: 'fact',
              content: [
                'Adresse extraite du document',
                payload.label,
                payload.addressLine1,
                [payload.postalCode, payload.city].filter(Boolean).join(' '),
              ]
                .filter(Boolean)
                .join(' — '),
              sourceEntityType: 'location',
              sourceEntityId: location.id,
              importance: 0.6,
            });
          }
        }
      }

      if (projectMemoryUpdateService && toAccept.length) {
        projectMemoryUpdateService.recordEventSafe({
          projectId,
          nodeType: 'decision',
          content: `Application scan #${scanId} : ${toAccept.length} élément(s) accepté(s) depuis le document #${scan.documentId}`,
          sourceEntityType: 'document_scan',
          sourceEntityId: scanId,
          importance: 0.75,
        });
      }

      return hydrateScan(await documentScanRepository.findById(scanId));
    },

    async dismissScan(userId, projectId, scanId) {
      await assertProjectOwner(userId, projectId);
      const scan = await documentScanRepository.findById(scanId);
      if (!scan || scan.projectId !== Number(projectId)) {
        throw new AppError('Scan introuvable', 404);
      }
      await documentScanRepository.update(scanId, { status: 'dismissed' });
      return hydrateScan(await documentScanRepository.findById(scanId));
    },
  };
}
