import { emailShell, escapeHtml } from './render.js';

/**
 * Notification de progression projet.
 * @param {{ projectTitle: string, stageLabel?: string, percent?: number|null, message?: string, url: string }} vars
 */
export function renderProjectProgress(vars = {}) {
  const projectTitle = String(vars.projectTitle || 'Votre projet');
  const stageLabel = String(vars.stageLabel || '').trim();
  const percent =
    vars.percent != null && Number.isFinite(Number(vars.percent))
      ? Math.max(0, Math.min(100, Math.round(Number(vars.percent))))
      : null;
  const message = String(vars.message || '').trim();
  const url = String(vars.url || '');

  const subject = `Progression : ${projectTitle}`;
  const textLines = [
    subject,
    stageLabel ? `Étape : ${stageLabel}` : '',
    percent != null ? `Avancement : ${percent}%` : '',
    message,
    url,
  ].filter(Boolean);
  const text = textLines.join('\n');

  const rows = [
    `<p style="margin:0 0 10px"><strong>Projet :</strong> ${escapeHtml(projectTitle)}</p>`,
    stageLabel
      ? `<p style="margin:0 0 10px"><strong>Étape :</strong> ${escapeHtml(stageLabel)}</p>`
      : '',
    percent != null
      ? `<p style="margin:0 0 10px"><strong>Avancement :</strong> ${percent}%</p>`
      : '',
    message ? `<p style="margin:14px 0 0">${escapeHtml(message)}</p>` : '',
  ].join('');

  const html = emailShell({
    title: subject,
    bodyHtml: `<p style="margin:0 0 14px">Mise à jour de la progression de votre projet.</p>${rows}`,
    ctaLabel: 'Voir mon parcours',
    ctaUrl: url,
  });

  return { subject, text, html };
}
