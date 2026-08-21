/**
 * Scan complet d'un projet en base → création / mise à jour de la mémoire synaptique.
 * Idempotent via upsert sur (project, source_entity, node_type).
 */

import { AppError } from '../utils/AppError.js';

const KEY_CONTACT_CATEGORIES = new Set([
  'expert_comptable',
  'notaire',
  'avocat',
  'banquier',
  'assureur',
  'conseil',
]);

function trimContent(text, max = 4000) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function moneyLabel(amount, currency = 'EUR') {
  if (amount == null || amount === '') return null;
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount);
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n} ${currency || ''}`.trim();
  }
}

export function createProjectMemoryScanService({
  projectRepository,
  documentRepository,
  documentScanRepository = null,
  contactRepository,
  companyRepository,
  companyOfficerRepository,
  companyEstablishmentRepository,
  companyFinancialRepository,
  accountingProfileRepository,
  plannerEventRepository,
  learningRecordRepository,
  projectStageRepository,
  projectMemoryNodeRepository,
  projectMemoryEdgeRepository,
  projectMemorySnapshotService,
  aiService = null,
}) {
  const STRUCTURAL_SOURCES = new Set([
    'project',
    'company',
    'accounting_profile',
    'company_officer',
  ]);

  async function maybeEmbed(content, importance) {
    if (!aiService?.embedText) return null;
    // Priorité aux nœuds utiles au recall sémantique
    if (importance < 0.45) return null;
    try {
      return await aiService.embedText(content);
    } catch {
      return null;
    }
  }

  async function upsertFact({
    projectId,
    nodeType,
    content,
    sourceEntityType,
    sourceEntityId,
    importance = 0.5,
    confidence = 1,
    decayRate = null,
  }) {
    const text = trimContent(content, 6000);
    if (!text) return null;
    const resolvedDecay =
      decayRate != null
        ? decayRate
        : STRUCTURAL_SOURCES.has(sourceEntityType)
          ? 0.002
          : 0.01;
    const embedding = await maybeEmbed(text, importance);
    return projectMemoryNodeRepository.upsertFromSource({
      projectId,
      nodeType,
      content: text,
      sourceEntityType,
      sourceEntityId,
      importance,
      confidence,
      decayRate: resolvedDecay,
      embedding,
    });
  }

  async function linkNodes(projectId, sourceNodeId, targetNodeId, relationType = 'relates_to') {
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) return;
    await projectMemoryEdgeRepository.upsertEdge({
      projectId,
      sourceNodeId,
      targetNodeId,
      relationType,
      weight: 0.55,
    });
  }

  async function scanProjectRoot(project, counts) {
    const parts = [
      `Projet « ${project.title || project.quoi || 'Sans titre'} »`,
      project.quoi ? `activité : ${project.quoi}` : null,
      project.ou ? `lieu : ${project.ou}` : null,
      project.status ? `statut : ${project.status}` : null,
      project.stage ? `étape : ${project.stage}` : null,
      project.legalForm ? `forme : ${project.legalForm}` : null,
      moneyLabel(project.budget, project.currency)
        ? `budget : ${moneyLabel(project.budget, project.currency)}`
        : null,
      project.description ? `description : ${project.description}` : null,
    ].filter(Boolean);

    const node = await upsertFact({
      projectId: project.id,
      nodeType: 'fact',
      content: parts.join(' — '),
      sourceEntityType: 'project',
      sourceEntityId: project.id,
      importance: 0.95,
    });
    if (node) counts.nodes += 1;
    return node;
  }

  async function scanDocuments(projectId, projectNodeId, counts) {
    const docs = await documentRepository.findByProjectId(projectId);
    for (const doc of docs) {
      const label = doc.title || doc.fileName || `Document #${doc.id}`;
      const cat = doc.category?.title || doc.categoryTitle || doc.categorySlug;
      const excerpt = trimContent(doc.excerpt || doc.description || '', 1800);
      const content = [
        `Document : ${label}`,
        doc.type ? `type ${doc.type}` : null,
        cat ? `catégorie ${cat}` : null,
        doc.mimeType ? `mime ${doc.mimeType}` : null,
        doc.description && doc.description !== doc.excerpt
          ? `description : ${trimContent(doc.description, 500)}`
          : null,
        excerpt ? `extrait : ${excerpt}` : null,
        Array.isArray(doc.attributes?.tags) && doc.attributes.tags.length
          ? `tags : ${doc.attributes.tags.slice(0, 8).join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join(' — ');

      const node = await upsertFact({
        projectId,
        nodeType: 'fact',
        content,
        sourceEntityType: 'document',
        sourceEntityId: doc.id,
        importance: excerpt ? 0.65 : 0.55,
      });
      if (node) {
        counts.nodes += 1;
        counts.documents += 1;
        await linkNodes(projectId, projectNodeId, node.id, 'relates_to');
        counts.edges += 1;
      }
    }
  }

  async function scanDocumentInsights(projectId, projectNodeId, counts) {
    if (!documentScanRepository?.listByProjectId) return;
    const scans = await documentScanRepository.listByProjectId(projectId);
    for (const scan of scans) {
      if (scan.status !== 'ready') continue;
      const items = documentScanRepository.listItems
        ? await documentScanRepository.listItems(scan.id)
        : [];
      const accepted = items.filter((i) =>
        ['accepted', 'merged', 'suggested'].includes(i.status)
      );
      const labels = accepted
        .slice(0, 12)
        .map((i) => `${i.itemType}: ${i.label || JSON.stringify(i.payload || {}).slice(0, 80)}`)
        .filter(Boolean);
      const excerpt = trimContent(scan.rawTextExcerpt || '', 1200);
      if (!labels.length && !excerpt) continue;

      const content = [
        `Analyse IA document #${scan.documentId}`,
        `scan #${scan.id} (${scan.status})`,
        labels.length ? `éléments : ${labels.join(' · ')}` : null,
        excerpt ? `texte : ${excerpt}` : null,
      ]
        .filter(Boolean)
        .join(' — ');

      const node = await upsertFact({
        projectId,
        nodeType: 'insight',
        content,
        sourceEntityType: 'document_scan',
        sourceEntityId: scan.id,
        importance: 0.7,
      });
      if (node) {
        counts.nodes += 1;
        counts.documentScans = (counts.documentScans || 0) + 1;
        await linkNodes(projectId, projectNodeId, node.id, 'relates_to');
        counts.edges += 1;

        // Lien vers le nœud document si présent
        const docNode = await projectMemoryNodeRepository.findBySource({
          projectId,
          sourceEntityType: 'document',
          sourceEntityId: scan.documentId,
          nodeType: 'fact',
        });
        if (docNode) {
          await linkNodes(projectId, docNode.id, node.id, 'reinforces');
          counts.edges += 1;
        }
      }
    }
  }

  async function scanContacts(projectId, projectNodeId, counts) {
    const contacts = await contactRepository.findByProjectId(projectId);
    for (const contact of contacts) {
      const category = String(contact.category || '').toLowerCase();
      const isKey = KEY_CONTACT_CATEGORIES.has(category);
      const name = contact.displayName || contact.organization || `Contact #${contact.id}`;
      const content = [
        isKey ? `Contact clé (${category})` : `Contact (${category || contact.contactType || 'autre'})`,
        name,
        contact.organization && contact.displayName !== contact.organization
          ? contact.organization
          : null,
        contact.jobTitle || null,
        contact.email || null,
        contact.phone || contact.mobile || null,
        contact.city || null,
        contact.notes ? `notes : ${trimContent(contact.notes, 400)}` : null,
        Array.isArray(contact.tags) && contact.tags.length
          ? `tags : ${contact.tags.slice(0, 6).join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join(' — ');

      const node = await upsertFact({
        projectId,
        nodeType: 'fact',
        content,
        sourceEntityType: 'contact',
        sourceEntityId: contact.id,
        importance: isKey ? 0.7 : 0.45,
      });
      if (node) {
        counts.nodes += 1;
        counts.contacts += 1;
        await linkNodes(projectId, projectNodeId, node.id, 'relates_to');
        counts.edges += 1;
      }
    }
  }

  async function scanCompany(projectId, projectNodeId, counts) {
    const company = await companyRepository.findByProjectId(projectId);
    if (!company) return;

    const companyContent = [
      `Société « ${company.denomination || company.tradeName || `#${company.id}`} »`,
      company.lifecycleState ? `cycle : ${company.lifecycleState}` : null,
      company.legalFormLabel || company.legalStatus || null,
      company.siren ? `SIREN ${company.siren}` : null,
      company.nafApeCode ? `NAF ${company.nafApeCode}` : null,
      moneyLabel(company.shareCapital, company.capitalCurrency || 'EUR')
        ? `capital ${moneyLabel(company.shareCapital, company.capitalCurrency || 'EUR')}`
        : null,
      company.activityDescription || null,
    ]
      .filter(Boolean)
      .join(' — ');

    const companyNode = await upsertFact({
      projectId,
      nodeType: 'fact',
      content: companyContent,
      sourceEntityType: 'company',
      sourceEntityId: company.id,
      importance: 0.85,
    });
    if (companyNode) {
      counts.nodes += 1;
      counts.companies += 1;
      await linkNodes(projectId, projectNodeId, companyNode.id, 'depends_on');
      counts.edges += 1;
    }

    const officers = await companyOfficerRepository.findByCompanyId(company.id);
    for (const officer of officers) {
      const node = await upsertFact({
        projectId,
        nodeType: 'fact',
        content: [
          `Dirigeant / BE : ${officer.personName || 'Inconnu'}`,
          officer.role || null,
          officer.ownershipPercent != null ? `${officer.ownershipPercent}%` : null,
          officer.isBeneficialOwner ? 'bénéficiaire effectif' : null,
        ]
          .filter(Boolean)
          .join(' — '),
        sourceEntityType: 'company_officer',
        sourceEntityId: officer.id,
        importance: 0.6,
      });
      if (node) {
        counts.nodes += 1;
        if (companyNode) {
          await linkNodes(projectId, companyNode.id, node.id, 'relates_to');
          counts.edges += 1;
        }
      }
    }

    const establishments = await companyEstablishmentRepository.findByCompanyId(company.id);
    for (const est of establishments) {
      const node = await upsertFact({
        projectId,
        nodeType: 'fact',
        content: [
          `Établissement : ${est.label || est.siret || `#${est.id}`}`,
          est.siret ? `SIRET ${est.siret}` : null,
          est.isHeadquarters ? 'siège' : null,
          est.isActive === false ? 'inactif' : null,
        ]
          .filter(Boolean)
          .join(' — '),
        sourceEntityType: 'company_establishment',
        sourceEntityId: est.id,
        importance: 0.5,
      });
      if (node) {
        counts.nodes += 1;
        if (companyNode) {
          await linkNodes(projectId, companyNode.id, node.id, 'relates_to');
          counts.edges += 1;
        }
      }
    }

    const financials = await companyFinancialRepository.findByCompanyId(company.id);
    for (const fin of financials.slice(0, 5)) {
      const node = await upsertFact({
        projectId,
        nodeType: 'insight',
        content: [
          `Comptes ${fin.fiscalYear || ''}`.trim(),
          fin.revenue != null
            ? `CA ${moneyLabel(fin.revenue, fin.currency || 'EUR')}`
            : null,
          fin.netIncome != null
            ? `résultat ${moneyLabel(fin.netIncome, fin.currency || 'EUR')}`
            : null,
        ]
          .filter(Boolean)
          .join(' — '),
        sourceEntityType: 'company_financial',
        sourceEntityId: fin.id,
        importance: 0.55,
      });
      if (node) {
        counts.nodes += 1;
        if (companyNode) {
          await linkNodes(projectId, companyNode.id, node.id, 'relates_to');
          counts.edges += 1;
        }
      }
    }

    const accounting = await accountingProfileRepository.findByCompanyId(company.id);
    if (accounting) {
      const node = await upsertFact({
        projectId,
        nodeType: 'fact',
        content: [
          'Profil comptable',
          accounting.taxRegime || null,
          accounting.vatRegime || null,
          accounting.accountingStandard || null,
          accounting.firmName ? `cabinet ${accounting.firmName}` : null,
        ]
          .filter(Boolean)
          .join(' — '),
        sourceEntityType: 'accounting_profile',
        sourceEntityId: accounting.id,
        importance: 0.5,
      });
      if (node) {
        counts.nodes += 1;
        if (companyNode) {
          await linkNodes(projectId, companyNode.id, node.id, 'relates_to');
          counts.edges += 1;
        }
      }
    }
  }

  async function scanPlanner(projectId, projectNodeId, counts) {
    const events = await plannerEventRepository.findByProjectId(projectId);
    for (const event of events) {
      const done = event.status === 'done';
      const content = [
        done ? 'Événement terminé' : `Événement planifié (${event.kind || 'task'})`,
        event.title,
        event.status && !done ? `statut ${event.status}` : null,
        event.location || null,
        event.description || null,
      ]
        .filter(Boolean)
        .join(' : ')
        .replace(/^([^:]+) : (.+)$/, '$1 : $2');

      const node = await upsertFact({
        projectId,
        nodeType: 'event',
        content,
        sourceEntityType: 'planner_event',
        sourceEntityId: event.id,
        importance: done ? 0.6 : 0.5,
      });
      if (node) {
        counts.nodes += 1;
        counts.plannerEvents += 1;
        await linkNodes(projectId, projectNodeId, node.id, 'relates_to');
        counts.edges += 1;
      }
    }
  }

  async function scanLearning(project, projectNodeId, counts) {
    const records = await learningRecordRepository.findByUser(project.userId, {
      projectId: project.id,
    });
    for (const rec of records) {
      const content = [
        `${rec.recordType || 'Formation'} « ${rec.title} »`,
        rec.status ? `(${rec.status})` : null,
        rec.organization || null,
        rec.level || null,
        rec.field || null,
        rec.format || null,
        rec.durationLabel || null,
        rec.startDate || rec.endDate
          ? `période ${rec.startDate || '?'} → ${rec.endDate || '?'}`
          : null,
        Array.isArray(rec.skills) && rec.skills.length
          ? `compétences : ${rec.skills.slice(0, 10).join(', ')}`
          : null,
        rec.description ? trimContent(rec.description, 600) : null,
        rec.notes ? `notes : ${trimContent(rec.notes, 300)}` : null,
      ]
        .filter(Boolean)
        .join(' — ');

      const node = await upsertFact({
        projectId: project.id,
        nodeType: 'fact',
        content,
        sourceEntityType: 'learning_record',
        sourceEntityId: rec.id,
        importance: 0.55,
      });
      if (node) {
        counts.nodes += 1;
        counts.learningRecords += 1;
        await linkNodes(project.id, projectNodeId, node.id, 'relates_to');
        counts.edges += 1;
      }
    }
  }

  async function scanStages(projectId, projectNodeId, counts) {
    const runs = await projectStageRepository.listRunsByProjectId(projectId);
    for (const run of runs) {
      const runNode = await upsertFact({
        projectId,
        nodeType: 'event',
        content: [
          `Étape parcours « ${run.stage} »`,
          `statut ${run.status}`,
          run.progressPercent != null ? `avancement ${run.progressPercent}%` : null,
          run.summary || null,
        ]
          .filter(Boolean)
          .join(' — '),
        sourceEntityType: 'project_stage_run',
        sourceEntityId: run.id,
        importance: 0.7,
      });
      if (runNode) {
        counts.nodes += 1;
        counts.stageRuns += 1;
        await linkNodes(projectId, projectNodeId, runNode.id, 'follows');
        counts.edges += 1;
      }

      const tasks = await projectStageRepository.listTasks(run.id);
      for (const task of tasks) {
        if (!['done', 'in_progress'].includes(task.status)) continue;
        const title = task.action?.title || `Tâche #${task.id}`;
        const node = await upsertFact({
          projectId,
          nodeType: 'task_state',
          content:
            task.status === 'done'
              ? `Action terminée (${run.stage}) : ${title}`
              : `Action en cours (${run.stage}) : ${title}`,
          sourceEntityType: 'project_stage_task',
          sourceEntityId: task.id,
          importance: task.status === 'done' ? 0.65 : 0.5,
        });
        if (node) {
          counts.nodes += 1;
          counts.tasks += 1;
          if (runNode) {
            await linkNodes(projectId, runNode.id, node.id, 'depends_on');
            counts.edges += 1;
          }
        }
      }

      const milestones = await projectStageRepository.listMilestones(run.id);
      for (const ms of milestones) {
        if (ms.status !== 'done' && ms.status !== 'planned') continue;
        const title = ms.title || ms.slug || `Jalon #${ms.id}`;
        const node = await upsertFact({
          projectId,
          nodeType: 'milestone',
          content:
            ms.status === 'done'
              ? `Jalon atteint (${run.stage}) : ${title}`
              : `Jalon prévu (${run.stage}) : ${title}`,
          sourceEntityType: 'project_stage_milestone',
          sourceEntityId: ms.id,
          importance: ms.status === 'done' ? 0.75 : 0.45,
        });
        if (node) {
          counts.nodes += 1;
          counts.milestones += 1;
          if (runNode) {
            await linkNodes(projectId, runNode.id, node.id, 'follows');
            counts.edges += 1;
          }
        }
      }
    }
  }

  return {
    /**
     * Parcourt toutes les dépendances projet et upsert la mémoire + snapshot.
     */
    async scanAndRebuild(projectId) {
      const project = await projectRepository.findById(projectId);
      if (!project) {
        throw new AppError('Projet introuvable', 404);
      }

      const counts = {
        nodes: 0,
        edges: 0,
        documents: 0,
        contacts: 0,
        companies: 0,
        plannerEvents: 0,
        learningRecords: 0,
        documentScans: 0,
        stageRuns: 0,
        tasks: 0,
        milestones: 0,
      };

      const projectNode = await scanProjectRoot(project, counts);
      const projectNodeId = projectNode?.id || null;

      await scanDocuments(projectId, projectNodeId, counts);
      await scanDocumentInsights(projectId, projectNodeId, counts);
      await scanContacts(projectId, projectNodeId, counts);
      await scanCompany(projectId, projectNodeId, counts);
      await scanPlanner(projectId, projectNodeId, counts);
      await scanLearning(project, projectNodeId, counts);
      await scanStages(projectId, projectNodeId, counts);

      let snapshot = null;
      if (projectMemorySnapshotService) {
        snapshot = await projectMemorySnapshotService.regenerate(projectId);
      }

      return {
        projectId,
        projectTitle: project.title || project.quoi || null,
        createdOrUpdated: counts.nodes > 0,
        counts,
        snapshot: snapshot
          ? {
              summary: snapshot.summary,
              keyFacts: snapshot.keyFacts,
              nextActions: snapshot.nextActions,
              generatedAt: snapshot.generatedAt,
              modelUsed: snapshot.modelUsed,
            }
          : null,
      };
    },
  };
}
