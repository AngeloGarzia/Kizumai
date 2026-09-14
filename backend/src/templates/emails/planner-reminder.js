import { emailShell, escapeHtml } from './render.js';

/**
 * Rappel planner (tâche / échéance / RDV).
 * @param {{ kindLabel: string, eventTitle: string, when: string, location?: string, description?: string, url: string }} vars
 */
export function renderPlannerReminder(vars = {}) {
  const kindLabel = String(vars.kindLabel || 'Rappel');
  const eventTitle = String(vars.eventTitle || 'Événement');
  const when = String(vars.when || '');
  const location = String(vars.location || '').trim();
  const description = String(vars.description || '').trim();
  const url = String(vars.url || '');

  const subject = `${kindLabel} : ${eventTitle}`;
  const textParts = [when, location, description, url].filter(Boolean);
  const text = `${subject}\n\n${textParts.join('\n')}`;

  const rows = [
    when ? `<p style="margin:0 0 10px"><strong>Quand :</strong> ${escapeHtml(when)}</p>` : '',
    location ? `<p style="margin:0 0 10px"><strong>Lieu :</strong> ${escapeHtml(location)}</p>` : '',
    description
      ? `<p style="margin:0 0 10px"><strong>Détail :</strong> ${escapeHtml(description)}</p>`
      : '',
  ].join('');

  const html = emailShell({
    title: subject,
    bodyHtml: `<p style="margin:0 0 14px">Rappel concernant votre agenda Kizumai.</p>${rows}`,
    ctaLabel: 'Ouvrir l’agenda',
    ctaUrl: url,
  });

  return { subject, text, html };
}
