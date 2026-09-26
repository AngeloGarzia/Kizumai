/**
 * Collecteurs déterministes (sans IA) pour l'assistant fond de tâche.
 */

function daysFromNow(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (t - Date.now()) / (24 * 60 * 60 * 1000);
}

export async function collectPlannerSignals({ plannerEventRepository, projectId }) {
  const events = await plannerEventRepository.findByProjectId(projectId);
  const signals = [];

  for (const ev of events || []) {
    if (!['todo', 'in_progress'].includes(ev.status)) continue;
    const days = daysFromNow(ev.startAt);
    if (days == null) continue;

    const kindLabel =
      { deadline: 'Échéance', appointment: 'Rendez-vous', task: 'Tâche', reminder: 'Rappel' }[
        ev.kind
      ] || 'Événement';

    if (days < 0) {
      signals.push({
        kind: 'deadline',
        priority: 'high',
        title: `${kindLabel} en retard : ${ev.title}`,
        body: `Prévu le ${new Date(ev.startAt).toLocaleDateString('fr-FR')}. À traiter ou reporter.`,
        dedupeKey: `deadline-overdue-${ev.id}`,
        payload: {
          eventId: ev.id,
          url: '/planner',
        },
      });
    } else if (days <= 3) {
      signals.push({
        kind: 'deadline',
        priority: 'high',
        title: `${kindLabel} dans ${Math.max(0, Math.ceil(days))} j : ${ev.title}`,
        body: 'Échéance proche — préparez-vous ou confirmez le rendez-vous.',
        dedupeKey: `deadline-soon-${ev.id}`,
        payload: {
          eventId: ev.id,
          url: '/planner',
        },
      });
    } else if (days <= 7) {
      signals.push({
        kind: 'deadline',
        priority: 'medium',
        title: `${kindLabel} cette semaine : ${ev.title}`,
        body: `Le ${new Date(ev.startAt).toLocaleDateString('fr-FR')}.`,
        dedupeKey: `deadline-week-${ev.id}`,
        payload: {
          eventId: ev.id,
          url: '/planner',
        },
      });
    }
  }

  return signals;
}

export async function collectDocumentGaps({
  projectStageRepository,
  documentRepository,
  documentScanRepository,
  project,
}) {
  const signals = [];
  const stage = project.stage || 'idee';
  const run = await projectStageRepository.findRun(project.id, stage);

  if (run) {
    const [tasks, links] = await Promise.all([
      projectStageRepository.listTasks(run.id),
      projectStageRepository.listLinks(run.id),
    ]);
    const docLinkTaskIds = new Set(
      (links || [])
        .filter((l) => l.entityType === 'document' && l.metadata?.taskId)
        .map((l) => Number(l.metadata.taskId))
    );
    const hasAnyDoc = (links || []).some((l) => l.entityType === 'document');

    for (const task of tasks || []) {
      if (task.status === 'done' || task.status === 'skipped') continue;
      if (!task.action?.isRequired) continue;
      const linked = docLinkTaskIds.has(Number(task.id));
      if (!linked && !hasAnyDoc) {
        signals.push({
          kind: 'missing_document',
          priority: 'medium',
          title: `Document manquant : ${task.action?.title || task.id}`,
          body: `La tâche requise « ${task.action?.title || 'sans titre'} » n’a pas encore de document lié.`,
          dedupeKey: `missing-doc-task-${task.id}`,
          payload: {
            taskId: task.id,
            stage,
            url: `/projet/${project.id}/etape/${stage}`,
          },
        });
      }
    }
  }

  const docs = await documentRepository.findByProjectId(project.id);
  if (!docs?.length && stage !== 'idee') {
    signals.push({
      kind: 'missing_document',
      priority: 'medium',
      title: 'Aucun document sur le projet',
      body: 'Ajoutez vos pièces utiles (études, devis, pièces admin) pour enrichir la mémoire Fabulous.',
      dedupeKey: 'missing-doc-none',
      payload: { url: '/ressources' },
    });
  }

  if (documentScanRepository?.listByProjectId) {
    const scans = await documentScanRepository.listByProjectId(project.id);
    for (const scan of scans || []) {
      if (scan.status !== 'ready') continue;
      const items = documentScanRepository.listItems
        ? await documentScanRepository.listItems(scan.id)
        : [];
      const pending = (items || []).filter((i) => i.status === 'suggested');
      if (!pending.length) continue;
      const hasSummary = pending.some((i) => i.itemType === 'summary');
      signals.push({
        kind: 'scan_pending',
        priority: hasSummary ? 'high' : 'medium',
        title: hasSummary
          ? 'Résumé document à valider'
          : 'Suggestions document à valider',
        body: `${pending.length} suggestion(s) en attente sur un document scanné.`,
        dedupeKey: `scan-pending-${scan.id}`,
        payload: {
          scanId: scan.id,
          documentId: scan.documentId,
          url: '/ressources',
        },
      });
    }
  }

  return signals;
}

export async function collectStageStagnation({
  projectStageRepository,
  project,
  stagnationDays = 7,
}) {
  const signals = [];
  const stage = project.stage || 'idee';
  const run = await projectStageRepository.findRun(project.id, stage);
  const ref = run?.updatedAt || project.updatedAt;
  if (!ref) return signals;

  const ageDays = -daysFromNow(ref);
  if (ageDays == null || ageDays < stagnationDays) return signals;

  const tasks = run ? await projectStageRepository.listTasks(run.id) : [];
  const openRequired = (tasks || []).filter(
    (t) =>
      t.action?.isRequired &&
      t.status !== 'done' &&
      t.status !== 'skipped'
  );

  if (openRequired.length === 0 && ageDays < stagnationDays * 2) return signals;

  signals.push({
    kind: 'stagnation',
    priority: ageDays >= stagnationDays * 2 ? 'high' : 'medium',
    title: `Projet peu actif depuis ${Math.floor(ageDays)} jours`,
    body: openRequired.length
      ? `${openRequired.length} tâche(s) requise(s) encore ouvertes à l’étape ${stage}.`
      : `Reprenez le parcours (${stage}) ou mettez à jour vos prochaines actions.`,
    dedupeKey: `stagnation-${stage}-${Math.floor(ageDays / stagnationDays)}`,
    payload: {
      stage,
      url: stage === 'idee' ? `/projet/${project.id}` : `/projet/${project.id}/etape/${stage}`,
      openRequired: openRequired.length,
    },
  });

  return signals;
}

export async function collectMemoryFreshness({
  projectMemorySnapshotRepository,
  projectId,
  eventThreshold = 8,
  maxAgeHours = 24,
}) {
  const signals = [];
  const snap = await projectMemorySnapshotRepository.findByProjectId(projectId);

  if (!snap?.summary) {
    signals.push({
      kind: 'action',
      priority: 'low',
      title: 'Mémoire projet encore vide',
      body: 'Avancez dans le parcours et validez des documents pour construire le résumé Fabulous.',
      dedupeKey: 'memory-empty',
      payload: { url: '/' },
    });
    return signals;
  }

  const ageHours =
    snap.generatedAt != null
      ? (Date.now() - new Date(snap.generatedAt).getTime()) / (3600 * 1000)
      : null;
  const events = Number(snap.eventsSinceSnapshot) || 0;

  if (events >= eventThreshold || (ageHours != null && ageHours >= maxAgeHours * 2)) {
    signals.push({
      kind: 'action',
      priority: 'low',
      title: 'Mémoire à rafraîchir',
      body: `Le résumé projet a ${events} événement(s) en attente ou date de plus de ${Math.round(ageHours || 0)} h.`,
      dedupeKey: `memory-stale-${Math.floor((events || 0) / eventThreshold)}`,
      payload: { url: '/' },
    });
  }

  return signals;
}

export async function collectAllSignals(deps) {
  const [
    planner,
    docs,
    stagnation,
    memory,
  ] = await Promise.all([
    collectPlannerSignals(deps),
    collectDocumentGaps(deps),
    collectStageStagnation(deps),
    collectMemoryFreshness(deps),
  ]);
  return [...planner, ...docs, ...stagnation, ...memory];
}
