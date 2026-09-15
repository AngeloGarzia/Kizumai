import { AppError } from '../utils/AppError.js';
import { PROJECT_STAGE_IDS, PROJECT_STAGE_LABELS } from '../constants/projectStages.js';
import { withAiUsageContext } from '../utils/aiUsage.js';

const STAGES = new Set(PROJECT_STAGE_IDS);
const TASK_STATUSES = new Set(['todo', 'in_progress', 'done', 'skipped']);
const MILESTONE_STATUSES = new Set(['planned', 'done', 'cancelled']);
const LINK_TYPES = new Set(['document', 'contact', 'planner_event', 'task']);

function stageIndex(stage) {
  return PROJECT_STAGE_IDS.indexOf(stage);
}

function nextStageId(stage) {
  const i = stageIndex(stage);
  if (i < 0 || i >= PROJECT_STAGE_IDS.length - 1) return null;
  return PROJECT_STAGE_IDS[i + 1];
}

function computeProgress(tasks) {
  const required = tasks.filter((t) => t.action?.isRequired !== false);
  const pool = required.length ? required : tasks;
  if (!pool.length) return 0;
  const done = pool.filter((t) => t.status === 'done' || t.status === 'skipped').length;
  return Math.round((done / pool.length) * 100);
}

/** Jalon « Lancement de l'étude » : confirmation UI si validation anticipée ; auto-validé à 100 %. */
const TASK_GATED_MILESTONE_SLUGS = new Set(['kickoff']);

function requiredTasksComplete(tasks) {
  const required = tasks.filter((t) => t.action?.isRequired !== false);
  const pool = required.length ? required : tasks;
  if (!pool.length) return false;
  return pool.every((t) => t.status === 'done' || t.status === 'skipped');
}

function normalizeChecklist(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .map((item, index) => {
      if (typeof item === 'string') {
        return { id: `i${index}`, text: item.trim().slice(0, 300), why: '', done: false };
      }
      return {
        id: String(item.id || `i${index}`).slice(0, 40),
        text: String(item.text || '').trim().slice(0, 300),
        why: String(item.why || '').trim().slice(0, 300),
        done: Boolean(item.done),
      };
    })
    .filter((i) => i.text)
    .slice(0, 10);
  return {
    title: String(raw.title || 'Checklist').trim().slice(0, 200),
    summary: String(raw.summary || '').trim().slice(0, 800),
    items,
    generatedAt: raw.generatedAt || new Date().toISOString(),
    provider: raw.provider || null,
    model: raw.model || null,
  };
}

function groupWorkflows(tasks) {
  const map = new Map();
  for (const task of tasks) {
    const slug = task.action?.templateSlug || 'autre';
    if (!map.has(slug)) {
      map.set(slug, {
        slug,
        title: task.action?.templateTitle || 'Autres',
        sortOrder: task.action?.templateSortOrder ?? 999,
        tasks: [],
      });
    }
    map.get(slug).tasks.push(task);
  }
  return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function createProjectStageService({
  projectStageRepository,
  projectRepository,
  documentRepository,
  contactRepository,
  plannerEventRepository,
  projectMemoryUpdateService = null,
  aiService = null,
}) {
  async function assertProjectOwner(userId, projectId) {
    const project = await projectRepository.findById(projectId);
    if (!project || project.userId !== Number(userId)) {
      throw new AppError('Projet introuvable', 404);
    }
    return project;
  }

  async function resolveLinkedEntities(userId, projectId, links) {
    const documents = [];
    const contacts = [];
    const events = [];

    for (const link of links) {
      if (link.entityType === 'document') {
        const doc = await documentRepository.findById(link.entityId);
        if (doc && doc.projectId === Number(projectId)) {
          documents.push({ ...link, entity: doc });
        }
      } else if (link.entityType === 'contact') {
        const contact = await contactRepository.findById(link.entityId);
        if (contact && contact.userId === Number(userId)) {
          contacts.push({ ...link, entity: contact });
        }
      } else if (link.entityType === 'planner_event') {
        const event = await plannerEventRepository.findById(link.entityId);
        if (event && event.userId === Number(userId)) {
          events.push({ ...link, entity: event });
        }
      }
    }

    return { documents, contacts, events, raw: links };
  }

  function documentsForTask(task, linkedDocuments) {
    return linkedDocuments.filter((d) => {
      const meta = d.metadata || {};
      if (meta.taskId != null && Number(meta.taskId) === Number(task.id)) return true;
      if (meta.taskSlug && task.action?.slug && meta.taskSlug === task.action.slug) return true;
      return false;
    });
  }

  async function hydrateRun(run, userId, projectId) {
    const tasks = await projectStageRepository.listTasks(run.id);
    const links = await projectStageRepository.listLinks(run.id);
    const milestones = await projectStageRepository.listMilestones(run.id);
    const linked = await resolveLinkedEntities(userId, projectId, links);
    const progressPercent = computeProgress(tasks);

    const tasksWithDocs = tasks.map((task) => ({
      ...task,
      documents: documentsForTask(task, linked.documents),
      checklist: task.metadata?.checklist || null,
    }));

    return {
      run: { ...run, progressPercent },
      workflows: groupWorkflows(tasksWithDocs),
      tasks: tasksWithDocs,
      milestones,
      documents: linked.documents,
      contacts: linked.contacts,
      events: linked.events,
      links: linked.raw,
      progressPercent,
    };
  }

  async function refreshProgress(run, userId, projectId) {
    const tasks = await projectStageRepository.listTasks(run.id);
    const progressPercent = computeProgress(tasks);
    const required = tasks.filter((t) => t.action?.isRequired !== false);
    const allRequiredDone = requiredTasksComplete(tasks);

    let status = run.status;
    let completedAt = run.completedAt || null;
    let startedAt = run.startedAt || null;

    if (allRequiredDone) {
      status = 'completed';
      completedAt = completedAt || new Date().toISOString();
    } else if (tasks.some((t) => t.status === 'done' || t.status === 'in_progress')) {
      status = 'in_progress';
      startedAt = startedAt || new Date().toISOString();
      completedAt = null;
    } else {
      status = 'not_started';
      completedAt = null;
    }

    const updated = await projectStageRepository.updateRun(run.id, {
      status,
      progressPercent,
      startedAt,
      completedAt,
    });

    // Auto-valide « Lancement de l'étude » quand tout est terminé (ne force pas le retour en arrière).
    if (allRequiredDone) {
      const milestones = await projectStageRepository.listMilestones(run.id);
      for (const m of milestones) {
        if (TASK_GATED_MILESTONE_SLUGS.has(m.slug) && m.status !== 'done') {
          await projectStageRepository.updateMilestone(m.id, { status: 'done' });
        }
      }
    }

    if (status === 'completed') {
      const project = await projectRepository.findById(projectId);
      const next = nextStageId(run.stage);
      if (project && next && project.stage === run.stage) {
        await projectRepository.updateLifecycle(projectId, { stage: next });
      }
      if (project && run.stage === 'lancement' && project.status !== 'launched') {
        await projectRepository.updateLifecycle(projectId, { status: 'launched' });
      }
    }

    return hydrateRun(updated || { ...run, status, progressPercent, startedAt, completedAt }, userId, projectId);
  }

  return {
    async getOrCreate(userId, projectId, stage) {
      if (!STAGES.has(stage)) throw new AppError('Étape invalide', 400);
      const project = await assertProjectOwner(userId, projectId);

      let run = await projectStageRepository.findRun(projectId, stage);
      if (!run) {
        run = await projectStageRepository.createRun({
          projectId,
          stage,
          status: 'not_started',
        });
      }

      if (stage === 'etude_marche' && project.stage === 'idee') {
        await projectRepository.updateLifecycle(projectId, { stage: 'etude_marche' });
      } else if (stage !== 'idee') {
        const openedIdx = stageIndex(stage);
        const currentIdx = stageIndex(project.stage);
        if (openedIdx > currentIdx) {
          await projectRepository.updateLifecycle(projectId, { stage });
        }
      }

      const actions = await projectStageRepository.listActiveActionsForStage(stage);
      await projectStageRepository.seedTasks(
        run.id,
        actions.map((a) => a.id)
      );

      const existingMilestones = await projectStageRepository.listMilestones(run.id);
      if (!existingMilestones.length) {
        const templates = await projectStageRepository.listMilestoneTemplates(stage);
        const base = new Date();
        await projectStageRepository.seedMilestones(
          run.id,
          templates.map((t) => {
            const at = new Date(base);
            at.setDate(at.getDate() + (t.offsetDays || 0));
            return {
              slug: t.slug,
              title: t.title,
              description: t.description,
              milestoneAt: at.toISOString(),
              sortOrder: t.sortOrder,
            };
          })
        );
      }

      return refreshProgress(run, userId, projectId);
    },

    async updateTask(userId, projectId, stage, taskId, payload) {
      if (!STAGES.has(stage)) throw new AppError('Étape invalide', 400);
      await assertProjectOwner(userId, projectId);
      const run = await projectStageRepository.findRun(projectId, stage);
      if (!run) throw new AppError('Étude introuvable', 404);

      const task = await projectStageRepository.findTask(run.id, taskId);
      if (!task) throw new AppError('Action introuvable', 404);

      if (payload.status != null && !TASK_STATUSES.has(payload.status)) {
        throw new AppError('Statut invalide', 400);
      }

      const fields = {};
      if (payload.status != null) {
        fields.status = payload.status;
        if (payload.status === 'done') {
          fields.completedAt = new Date().toISOString();
          fields.completedBy = Number(userId);
        } else if (payload.status === 'todo' || payload.status === 'in_progress' || payload.status === 'skipped') {
          if (payload.status !== 'skipped') {
            fields.completedAt = null;
            fields.completedBy = null;
          }
        }
      }
      if (payload.notes !== undefined) {
        fields.notes = payload.notes == null ? null : String(payload.notes).slice(0, 5000);
      }
      if (payload.dueAt !== undefined) {
        fields.dueAt = payload.dueAt || null;
      }
      if (payload.metadata !== undefined || payload.checklist !== undefined) {
        const currentMeta =
          task.metadata && typeof task.metadata === 'object' ? { ...task.metadata } : {};
        if (payload.metadata && typeof payload.metadata === 'object') {
          Object.assign(currentMeta, payload.metadata);
        }
        if (payload.checklist && typeof payload.checklist === 'object') {
          currentMeta.checklist = normalizeChecklist(payload.checklist);
        }
        fields.metadata = currentMeta;
      }

      await projectStageRepository.updateTask(task.id, fields);

      if (projectMemoryUpdateService && fields.status === 'done') {
        projectMemoryUpdateService.recordEventSafe({
          projectId,
          nodeType: 'task_state',
          content: `Action terminée (${stage}) : ${task.action?.title || task.action?.slug || `#${task.id}`}`,
          sourceEntityType: 'project_stage_task',
          sourceEntityId: task.id,
          importance: 0.65,
        });
      }

      return refreshProgress(run, userId, projectId);
    },

    async updateMilestone(userId, projectId, stage, milestoneId, payload) {
      if (!STAGES.has(stage)) throw new AppError('Étape invalide', 400);
      await assertProjectOwner(userId, projectId);
      const run = await projectStageRepository.findRun(projectId, stage);
      if (!run) throw new AppError('Étude introuvable', 404);

      const milestone = await projectStageRepository.findMilestone(run.id, milestoneId);
      if (!milestone) throw new AppError('Jalon introuvable', 404);

      if (payload.status != null && !MILESTONE_STATUSES.has(payload.status)) {
        throw new AppError('Statut de jalon invalide', 400);
      }

      const fields = {};
      if (payload.title !== undefined) fields.title = payload.title;
      if (payload.description !== undefined) fields.description = payload.description;
      if (payload.milestoneAt !== undefined) fields.milestoneAt = payload.milestoneAt;
      if (payload.status !== undefined) fields.status = payload.status;
      if (payload.taskId !== undefined) fields.taskId = payload.taskId;

      await projectStageRepository.updateMilestone(milestone.id, fields);

      if (projectMemoryUpdateService && fields.status === 'done') {
        projectMemoryUpdateService.recordEventSafe({
          projectId,
          nodeType: 'milestone',
          content: `Jalon atteint (${stage}) : ${milestone.title || milestone.slug}`,
          sourceEntityType: 'project_stage_milestone',
          sourceEntityId: milestone.id,
          importance: 0.75,
        });
      }

      return refreshProgress(run, userId, projectId);
    },

    async addLink(userId, projectId, stage, payload) {
      if (!STAGES.has(stage)) throw new AppError('Étape invalide', 400);
      await assertProjectOwner(userId, projectId);
      const run = await projectStageRepository.findRun(projectId, stage);
      if (!run) throw new AppError('Étude introuvable', 404);

      const entityType = payload.entityType;
      const entityId = Number(payload.entityId);
      if (!LINK_TYPES.has(entityType) || !entityId) {
        throw new AppError('Lien invalide', 400);
      }

      if (entityType === 'document') {
        const doc = await documentRepository.findById(entityId);
        if (!doc || doc.projectId !== Number(projectId)) {
          throw new AppError('Document introuvable', 404);
        }
      }
      if (entityType === 'contact') {
        const contact = await contactRepository.findById(entityId);
        if (!contact || contact.userId !== Number(userId)) {
          throw new AppError('Contact introuvable', 404);
        }
      }
      if (entityType === 'planner_event') {
        const event = await plannerEventRepository.findById(entityId);
        if (!event || event.userId !== Number(userId)) {
          throw new AppError('Événement introuvable', 404);
        }
      }

      await projectStageRepository.createLink({
        stageRunId: run.id,
        entityType,
        entityId,
        role: payload.role ? String(payload.role).slice(0, 80) : null,
        note: payload.note ? String(payload.note).slice(0, 2000) : null,
        metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
      });

      return hydrateRun(run, userId, projectId);
    },

    async generateTaskChecklist(userId, projectId, stage, taskId) {
      if (!STAGES.has(stage)) throw new AppError('Étape invalide', 400);
      if (!aiService?.generateFabulousTaskChecklist) {
        throw new AppError('Service Fabulous indisponible', 503);
      }
      const project = await assertProjectOwner(userId, projectId);
      const run = await projectStageRepository.findRun(projectId, stage);
      if (!run) throw new AppError('Étude introuvable', 404);

      const task = await projectStageRepository.findTask(run.id, taskId);
      if (!task) throw new AppError('Action introuvable', 404);

      const links = await projectStageRepository.listLinks(run.id);
      const linked = await resolveLinkedEntities(userId, projectId, links);
      const taskDocs = documentsForTask(task, linked.documents);
      const linkedDocsLabel = taskDocs.length
        ? taskDocs
            .map((d) => d.entity?.title || d.entity?.fileName || `#${d.entityId}`)
            .join(', ')
        : '(aucun)';

      const allTasks = await projectStageRepository.listTasks(run.id);
      const progressPercent = computeProgress(allTasks);

      // Checklist Fabulous (prompt en base) — contexte déjà résolu hors callback.

      const checklistRaw = await withAiUsageContext(
        { userId, projectId, purpose: 'fabulous_task_checklist' },
        () =>
          aiService.generateFabulousTaskChecklist({
            stage,
            stageLabel: PROJECT_STAGE_LABELS[stage] || stage,
            workflowTitle: task.action?.templateTitle || '—',
            taskTitle: task.action?.title || 'Action',
            taskSlug: task.action?.slug || '',
            taskDescription: task.action?.description || '',
            projectTitle: project.title || project.quoi || '',
            linkedDocs: linkedDocsLabel,
            taskNotes: task.notes || '',
            progressPercent,
          })
      );

      const checklist = normalizeChecklist({
        ...checklistRaw,
        generatedAt: new Date().toISOString(),
      });

      const meta = task.metadata && typeof task.metadata === 'object' ? { ...task.metadata } : {};
      meta.checklist = checklist;
      await projectStageRepository.updateTask(task.id, { metadata: meta });

      if (projectMemoryUpdateService) {
        projectMemoryUpdateService.recordEventSafe({
          projectId,
          nodeType: 'insight',
          content: `Checklist Fabulous pour « ${task.action?.title || task.action?.slug} » (${checklist.items.length} points)`,
          sourceEntityType: 'project_stage_task',
          sourceEntityId: task.id,
          importance: 0.5,
        });
      }

      const payload = await hydrateRun(run, userId, projectId);
      return { ...payload, checklist };
    },

    async removeLink(userId, projectId, stage, linkId) {
      await assertProjectOwner(userId, projectId);
      const run = await projectStageRepository.findRun(projectId, stage);
      if (!run) throw new AppError('Étude introuvable', 404);
      const ok = await projectStageRepository.deleteLink(run.id, linkId);
      if (!ok) throw new AppError('Lien introuvable', 404);
      return hydrateRun(run, userId, projectId);
    },

    async createContactAndLink(userId, projectId, stage, payload) {
      if (!STAGES.has(stage)) throw new AppError('Étape invalide', 400);
      await assertProjectOwner(userId, projectId);
      const run = await projectStageRepository.findRun(projectId, stage);
      if (!run) throw new AppError('Étude introuvable', 404);

      const displayName = String(payload.displayName || payload.name || '').trim().slice(0, 200);
      if (!displayName) throw new AppError('Le nom du contact est requis', 400);

      const contact = await contactRepository.create({
        userId: Number(userId),
        projectId: Number(projectId),
        contactType: payload.contactType === 'company' ? 'company' : 'person',
        category: payload.category || 'autre',
        displayName,
        firstName: payload.firstName || null,
        lastName: payload.lastName || null,
        organization: payload.organization || null,
        email: payload.email || null,
        phone: payload.phone || null,
        notes: payload.notes || null,
        source: 'market_study',
      });

      await projectStageRepository.createLink({
        stageRunId: run.id,
        entityType: 'contact',
        entityId: contact.id,
        role: payload.role || 'interviewé',
        note: payload.linkNote || null,
      });

      return hydrateRun(run, userId, projectId);
    },

    async linkDocumentAfterUpload(userId, projectId, stage, documentId, role = 'preuve') {
      return this.addLink(userId, projectId, stage, {
        entityType: 'document',
        entityId: documentId,
        role,
      });
    },
  };
}
