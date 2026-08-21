import { AppError } from '../utils/AppError.js';

const RECORD_TYPES = new Set(['formation', 'diplome', 'etude', 'bilan_competences']);
const STATUSES = new Set(['envisage', 'en_cours', 'termine', 'abandonne']);
const FORMATS = new Set(['en_ligne', 'presentiel', 'mixte']);
const SOURCES = new Set(['manual', 'ai_suggestion', 'import']);

const LIMITS = {
  title: 255,
  organization: 255,
  level: 80,
  field: 120,
  durationLabel: 80,
  description: 5000,
  notes: 5000,
  skills: 20,
  skillLen: 80,
};

function clip(value, max) {
  const s = String(value || '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function parseDateOnly(value, field) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  const day = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;
  if (!day) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new AppError(`Date invalide : ${field}`, 400);
    }
    return parsed.toISOString().slice(0, 10);
  }
  const check = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== day) {
    throw new AppError(`Date invalide : ${field}`, 400);
  }
  return day;
}

function normalizeFormat(value) {
  if (value == null || value === '') return null;
  const raw = String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (raw.includes('ligne') || raw === 'online') return 'en_ligne';
  if (raw.includes('present') || raw.includes('présent')) return 'presentiel';
  if (FORMATS.has(raw)) return raw;
  throw new AppError('Format invalide (en_ligne | presentiel | mixte).', 400);
}

function normalizeSkills(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => clip(s, LIMITS.skillLen))
    .filter(Boolean)
    .slice(0, LIMITS.skills);
}

function normalizePayload(raw, { partial = false } = {}) {
  const out = {};

  if (!partial || raw.recordType !== undefined) {
    if (!RECORD_TYPES.has(raw.recordType)) {
      throw new AppError(
        'Type invalide (formation | diplome | etude | bilan_competences).',
        400
      );
    }
    out.recordType = raw.recordType;
  }

  if (!partial || raw.title !== undefined) {
    const title = clip(raw.title, LIMITS.title);
    if (!title) throw new AppError('Le titre est requis.', 400);
    out.title = title;
  }

  if (raw.organization !== undefined) {
    out.organization = clip(raw.organization, LIMITS.organization);
  }
  if (raw.status !== undefined) {
    if (!STATUSES.has(raw.status)) {
      throw new AppError('Statut invalide.', 400);
    }
    out.status = raw.status;
  }
  if (raw.level !== undefined) out.level = clip(raw.level, LIMITS.level);
  if (raw.field !== undefined) out.field = clip(raw.field, LIMITS.field);
  if (raw.format !== undefined) {
    out.format = normalizeFormat(raw.format);
  }
  if (raw.startDate !== undefined) {
    out.startDate = parseDateOnly(raw.startDate, 'startDate');
  }
  if (raw.endDate !== undefined) {
    out.endDate = parseDateOnly(raw.endDate, 'endDate');
  }
  if (raw.durationLabel !== undefined) {
    out.durationLabel = clip(raw.durationLabel, LIMITS.durationLabel);
  }
  if (raw.diplomaObtained !== undefined) {
    out.diplomaObtained =
      raw.diplomaObtained == null ? null : Boolean(raw.diplomaObtained);
  }
  if (raw.skills !== undefined) {
    out.skills = normalizeSkills(raw.skills);
  }
  if (raw.description !== undefined) {
    out.description = clip(raw.description, LIMITS.description);
  }
  if (raw.notes !== undefined) out.notes = clip(raw.notes, LIMITS.notes);
  if (raw.aiSnapshot !== undefined) {
    out.aiSnapshot =
      raw.aiSnapshot && typeof raw.aiSnapshot === 'object' && !Array.isArray(raw.aiSnapshot)
        ? raw.aiSnapshot
        : {};
  }
  if (raw.metadata !== undefined) {
    out.metadata =
      raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
        ? raw.metadata
        : {};
  }
  if (raw.projectId !== undefined) {
    out.projectId = raw.projectId === '' || raw.projectId == null ? null : Number(raw.projectId);
    if (out.projectId != null && (!Number.isInteger(out.projectId) || out.projectId < 1)) {
      throw new AppError('Projet introuvable', 404);
    }
  }
  if (raw.documentId !== undefined) {
    out.documentId =
      raw.documentId === '' || raw.documentId == null ? null : Number(raw.documentId);
    if (out.documentId != null && (!Number.isInteger(out.documentId) || out.documentId < 1)) {
      throw new AppError('Document introuvable', 404);
    }
  }

  return out;
}

function assertDateOrder(startDate, endDate) {
  if (startDate && endDate && endDate < startDate) {
    throw new AppError('La date de fin doit être postérieure à la date de début.', 400);
  }
}

export function createLearningRecordService({
  learningRecordRepository,
  projectRepository,
  documentRepository,
  projectMemoryUpdateService = null,
}) {
  async function assertOwnedProject(userId, projectId) {
    if (projectId == null || projectId === '') return null;
    const id = Number(projectId);
    if (!Number.isInteger(id) || id < 1) {
      throw new AppError('Projet introuvable', 404);
    }
    const project = await projectRepository.findById(id);
    if (!project || project.userId !== userId) {
      throw new AppError('Projet introuvable', 404);
    }
    return project;
  }

  async function assertOwnedDocument(userId, documentId, projectId) {
    if (documentId == null || documentId === '') return null;
    const id = Number(documentId);
    if (!Number.isInteger(id) || id < 1) {
      throw new AppError('Document introuvable', 404);
    }
    const doc = await documentRepository.findById(id);
    if (!doc) throw new AppError('Document introuvable', 404);

    const project = await projectRepository.findById(doc.projectId);
    if (!project || project.userId !== userId) {
      throw new AppError('Document introuvable', 404);
    }
    if (projectId != null && projectId !== '' && Number(projectId) !== Number(doc.projectId)) {
      throw new AppError('Le document doit appartenir au même projet.', 400);
    }
    return doc;
  }

  async function resolveLinks(userId, { projectId, documentId }) {
    let nextProjectId = projectId ?? null;
    let nextDocumentId = documentId ?? null;

    if (nextProjectId != null) {
      await assertOwnedProject(userId, nextProjectId);
    }

    if (nextDocumentId != null) {
      const doc = await assertOwnedDocument(userId, nextDocumentId, nextProjectId);
      if (nextProjectId == null) {
        nextProjectId = Number(doc.projectId);
      }
    }

    return { projectId: nextProjectId, documentId: nextDocumentId };
  }

  return {
    async list(userId, { projectId, recordType } = {}) {
      if (recordType != null && recordType !== '' && !RECORD_TYPES.has(recordType)) {
        throw new AppError(
          'Type invalide (formation | diplome | etude | bilan_competences).',
          400
        );
      }
      if (projectId != null) await assertOwnedProject(userId, projectId);
      return learningRecordRepository.findByUser(userId, {
        projectId,
        recordType: recordType || undefined,
      });
    },

    async get(userId, id) {
      const record = await learningRecordRepository.findById(id);
      if (!record || record.userId !== userId) {
        throw new AppError('Fiche introuvable', 404);
      }
      return record;
    },

    async create(userId, raw, { source = 'manual' } = {}) {
      const data = normalizePayload(raw, { partial: false });
      const links = await resolveLinks(userId, {
        projectId: data.projectId,
        documentId: data.documentId,
      });
      assertDateOrder(data.startDate, data.endDate);

      // La source est définie côté serveur uniquement (jamais via le body client).
      const resolvedSource = SOURCES.has(source) ? source : 'manual';

      const record = await learningRecordRepository.create({
        userId,
        ...data,
        projectId: links.projectId,
        documentId: links.documentId,
        status: data.status || 'envisage',
        source: resolvedSource,
        skills: data.skills || [],
        aiSnapshot: data.aiSnapshot || {},
        metadata: data.metadata || {},
      });

      if (projectMemoryUpdateService && record.projectId) {
        projectMemoryUpdateService.recordEventSafe({
          projectId: record.projectId,
          nodeType: 'fact',
          content: [
            `${record.recordType || 'Formation'} « ${record.title} »`,
            record.status ? `(${record.status})` : null,
            record.organization || null,
            record.level || null,
            Array.isArray(record.skills) && record.skills.length
              ? `compétences : ${record.skills.slice(0, 10).join(', ')}`
              : null,
            record.description
              ? String(record.description).slice(0, 500)
              : null,
          ]
            .filter(Boolean)
            .join(' — '),
          sourceEntityType: 'learning_record',
          sourceEntityId: record.id,
          importance: 0.58,
        });
      }

      return record;
    },

    async update(userId, id, raw) {
      const current = await this.get(userId, id);
      const data = normalizePayload(raw, { partial: true });

      if (data.projectId !== undefined || data.documentId !== undefined) {
        const links = await resolveLinks(userId, {
          projectId: data.projectId !== undefined ? data.projectId : current.projectId,
          documentId:
            data.documentId !== undefined ? data.documentId : current.documentId,
        });
        data.projectId = links.projectId;
        data.documentId = links.documentId;
      }

      const toDay = (value) => {
        if (!value) return null;
        if (value instanceof Date) return value.toISOString().slice(0, 10);
        return String(value).slice(0, 10);
      };
      assertDateOrder(
        toDay(data.startDate !== undefined ? data.startDate : current.startDate),
        toDay(data.endDate !== undefined ? data.endDate : current.endDate)
      );

      const updated = await learningRecordRepository.update(id, data);

      if (projectMemoryUpdateService && updated?.projectId) {
        projectMemoryUpdateService.recordEventSafe({
          projectId: updated.projectId,
          nodeType: 'fact',
          content: [
            `${updated.recordType || 'Formation'} « ${updated.title} »`,
            updated.status ? `(${updated.status})` : null,
            updated.organization || null,
            updated.level || null,
            Array.isArray(updated.skills) && updated.skills.length
              ? `compétences : ${updated.skills.slice(0, 10).join(', ')}`
              : null,
          ]
            .filter(Boolean)
            .join(' — '),
          sourceEntityType: 'learning_record',
          sourceEntityId: updated.id,
          importance: 0.58,
        });
      }

      return updated;
    },

    async remove(userId, id) {
      await this.get(userId, id);
      await learningRecordRepository.delete(id);
    },

    /** Persist une suggestion IA « Formation utile ? » (status envisage). */
    async createFromAiSuggestion(userId, { business, training, projectId = null }) {
      if (!training || typeof training !== 'object') {
        throw new AppError('Formation IA invalide.', 400);
      }

      const title = clip(training.title, LIMITS.title);
      if (!title) {
        throw new AppError('Formation IA invalide.', 400);
      }

      let format = null;
      if (training.format != null && training.format !== '') {
        try {
          format = normalizeFormat(training.format);
        } catch {
          format = 'mixte';
        }
      }

      const snapshot = {
        business: business && typeof business === 'object' ? business : business || null,
        training: {
          title,
          level: clip(training.level, LIMITS.level),
          duration: clip(training.duration, LIMITS.durationLabel),
          format,
          rationale: clip(training.rationale, LIMITS.description),
          skills: normalizeSkills(training.skills),
        },
        savedAt: new Date().toISOString(),
      };

      return this.create(
        userId,
        {
          recordType: 'formation',
          title,
          status: 'envisage',
          level: snapshot.training.level,
          format: snapshot.training.format,
          durationLabel: snapshot.training.duration,
          description: snapshot.training.rationale,
          skills: snapshot.training.skills,
          projectId,
          aiSnapshot: snapshot,
        },
        { source: 'ai_suggestion' }
      );
    },
  };
}
