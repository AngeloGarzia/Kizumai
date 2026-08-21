/**
 * Agrège chronologiquement les actions / uploads liés à un projet.
 */

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function pushEvent(events, event) {
  if (!event?.at) return;
  events.push(event);
}

export function createProjectTimelineService({
  projectRepository,
  documentRepository,
  documentScanRepository,
  contactRepository,
  companyRepository,
  plannerEventRepository,
  learningRecordRepository,
  projectStageRepository,
  projectMemoryNodeRepository,
  projectMemorySnapshotRepository,
}) {
  return {
    async buildTimeline(projectId, { limit = 200 } = {}) {
      const project = await projectRepository.findById(projectId);
      if (!project) return null;

      const events = [];

      pushEvent(events, {
        id: `project-created-${project.id}`,
        at: toIso(project.createdAt),
        type: 'project_created',
        category: 'project',
        title: 'Projet créé',
        summary: project.title || project.quoi || `Projet #${project.id}`,
        meta: { status: project.status, stage: project.stage },
      });

      if (project.updatedAt && toIso(project.updatedAt) !== toIso(project.createdAt)) {
        pushEvent(events, {
          id: `project-updated-${project.id}-${toIso(project.updatedAt)}`,
          at: toIso(project.updatedAt),
          type: 'project_updated',
          category: 'project',
          title: 'Projet mis à jour',
          summary: `Étape « ${project.stage} » · statut « ${project.status} »`,
          meta: { status: project.status, stage: project.stage },
        });
      }

      const documents = await documentRepository.findByProjectId(projectId);
      for (const doc of documents) {
        pushEvent(events, {
          id: `document-${doc.id}`,
          at: toIso(doc.createdAt),
          type: 'document_upload',
          category: 'document',
          title: 'Document ajouté',
          summary: doc.title || doc.fileName,
          meta: {
            documentId: doc.id,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
            type: doc.type,
            hasContent: doc.hasContent,
            categoryTitle: doc.category?.title || null,
          },
          href: `/ressources?doc=${doc.id}`,
          downloadPath: `/projects/${projectId}/documents/${doc.id}/download`,
        });
      }

      // Scans IA (si dispo)
      if (documentScanRepository?.listByProjectId) {
        const scans = await documentScanRepository.listByProjectId(projectId);
        for (const scan of scans) {
          pushEvent(events, {
            id: `scan-${scan.id}`,
            at: toIso(scan.finishedAt || scan.createdAt),
            type: 'document_scan',
            category: 'ai',
            title: 'Scan IA document',
            summary: `Statut : ${scan.status}`,
            meta: {
              scanId: scan.id,
              documentId: scan.documentId,
              status: scan.status,
            },
          });
        }
      }

      const contacts = await contactRepository.findByProjectId(projectId);
      for (const contact of contacts) {
        pushEvent(events, {
          id: `contact-${contact.id}`,
          at: toIso(contact.createdAt),
          type: 'contact_added',
          category: 'contact',
          title: 'Contact ajouté',
          summary:
            contact.displayName ||
            [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
            contact.organization ||
            `Contact #${contact.id}`,
          meta: {
            contactId: contact.id,
            category: contact.category,
            organization: contact.organization,
          },
        });
      }

      const company = await companyRepository.findByProjectId(projectId);
      if (company) {
        pushEvent(events, {
          id: `company-${company.id}`,
          at: toIso(company.createdAt),
          type: 'company_created',
          category: 'company',
          title: 'Société liée',
          summary: company.denomination || company.tradeName || `Société #${company.id}`,
          meta: {
            companyId: company.id,
            lifecycleState: company.lifecycleState,
            siren: company.siren,
          },
        });
      }

      const plannerEvents = await plannerEventRepository.findByProjectId(projectId);
      for (const event of plannerEvents) {
        pushEvent(events, {
          id: `planner-${event.id}`,
          at: toIso(event.createdAt || event.startAt),
          type: event.status === 'done' ? 'planner_done' : 'planner_event',
          category: 'planner',
          title: event.status === 'done' ? 'Événement terminé' : 'Événement planifié',
          summary: event.title,
          meta: {
            plannerEventId: event.id,
            kind: event.kind,
            status: event.status,
            startAt: toIso(event.startAt),
          },
          href: '/planner',
        });
      }

      const learning = await learningRecordRepository.findByUser(project.userId, {
        projectId,
      });
      for (const rec of learning) {
        pushEvent(events, {
          id: `learning-${rec.id}`,
          at: toIso(rec.createdAt),
          type: 'learning_added',
          category: 'learning',
          title: 'Compétence / formation',
          summary: rec.title,
          meta: {
            learningRecordId: rec.id,
            recordType: rec.recordType,
            status: rec.status,
          },
          href: '/competences',
        });
      }

      const runs = await projectStageRepository.listRunsByProjectId(projectId);
      for (const run of runs) {
        pushEvent(events, {
          id: `stage-run-${run.id}`,
          at: toIso(run.startedAt || run.createdAt),
          type: 'stage_started',
          category: 'stage',
          title: 'Étape de parcours',
          summary: `« ${run.stage} » · ${run.status}`
            + (run.progressPercent != null ? ` · ${run.progressPercent}%` : ''),
          meta: {
            stageRunId: run.id,
            stage: run.stage,
            status: run.status,
            progressPercent: run.progressPercent,
          },
          href: `/projet/${projectId}/etape/${run.stage}`,
        });

        const tasks = await projectStageRepository.listTasks(run.id);
        for (const task of tasks) {
          if (task.status !== 'done' && task.status !== 'in_progress') continue;
          pushEvent(events, {
            id: `task-${task.id}`,
            at: toIso(task.completedAt || task.updatedAt || task.createdAt),
            type: task.status === 'done' ? 'task_done' : 'task_progress',
            category: 'stage',
            title: task.status === 'done' ? 'Action terminée' : 'Action en cours',
            summary: `${task.action?.title || `Tâche #${task.id}`} (${run.stage})`,
            meta: {
              taskId: task.id,
              stage: run.stage,
              status: task.status,
            },
          });
        }

        const milestones = await projectStageRepository.listMilestones(run.id);
        for (const ms of milestones) {
          if (ms.status !== 'done') continue;
          pushEvent(events, {
            id: `milestone-${ms.id}`,
            at: toIso(ms.milestoneAt || ms.updatedAt || ms.createdAt),
            type: 'milestone_done',
            category: 'stage',
            title: 'Jalon atteint',
            summary: `${ms.title || ms.slug} (${run.stage})`,
            meta: {
              milestoneId: ms.id,
              stage: run.stage,
            },
          });
        }
      }

      if (projectMemoryNodeRepository?.listActiveByImportance) {
        const nodes = await projectMemoryNodeRepository.listActiveByImportance(projectId, {
          limit: 40,
        });
        for (const node of nodes) {
          // Éviter le bruit si déjà couvert par une source métier
          if (node.sourceEntityType && node.sourceEntityId) continue;
          pushEvent(events, {
            id: `memory-${node.id}`,
            at: toIso(node.createdAt),
            type: 'memory_node',
            category: 'ai',
            title: 'Souvenir mémoire IA',
            summary: String(node.content || '').slice(0, 160),
            meta: {
              nodeId: node.id,
              nodeType: node.nodeType,
              importance: node.importance,
            },
          });
        }
      }

      const snapshot = projectMemorySnapshotRepository
        ? await projectMemorySnapshotRepository.findByProjectId(projectId)
        : null;
      if (snapshot?.summary && snapshot.generatedAt) {
        pushEvent(events, {
          id: `snapshot-${snapshot.id || projectId}`,
          at: toIso(snapshot.generatedAt),
          type: 'memory_snapshot',
          category: 'ai',
          title: 'Snapshot mémoire IA',
          summary: String(snapshot.summary).slice(0, 200),
          meta: {
            modelUsed: snapshot.modelUsed,
          },
        });
      }

      events.sort((a, b) => new Date(b.at) - new Date(a.at));
      const capped = events.slice(0, Math.min(500, Math.max(20, Number(limit) || 200)));

      const documentsQuick = documents.map((doc) => ({
        id: doc.id,
        title: doc.title || doc.fileName,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        type: doc.type,
        createdAt: toIso(doc.createdAt),
        hasContent: doc.hasContent,
        downloadPath: `/projects/${projectId}/documents/${doc.id}/download`,
      }));

      const byCategory = capped.reduce((acc, ev) => {
        acc[ev.category] = (acc[ev.category] || 0) + 1;
        return acc;
      }, {});

      return {
        projectId,
        projectTitle: project.title || project.quoi || null,
        projectStage: project.stage,
        projectStatus: project.status,
        total: capped.length,
        byCategory,
        events: capped,
        documents: documentsQuick,
        snapshot: snapshot
          ? {
              summary: snapshot.summary,
              keyFacts: snapshot.keyFacts || [],
              nextActions: snapshot.nextActions || [],
              generatedAt: toIso(snapshot.generatedAt),
            }
          : null,
      };
    },
  };
}
