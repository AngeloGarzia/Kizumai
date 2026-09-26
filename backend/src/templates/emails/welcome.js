import { emailShell, escapeHtml } from './render.js';

/**
 * Bienvenue / mail de test admin — Kizumai, le propulseur de projet.
 * @param {{ name?: string, url?: string }} vars
 */
export function renderWelcomeEmail(vars = {}) {
  const name = String(vars.name || '').trim() || 'bonjour';
  const url = String(vars.url || '');

  const subject = 'Bienvenue sur Kizumai — le propulseur de projet';
  const text = [
    `Bonjour ${name},`,
    '',
    'Bienvenue sur Kizumai, le propulseur de projet.',
    'Kizumai vous accompagne pour clarifier votre idée, structurer votre parcours et avancer concrètement vers le lancement.',
    '',
    'Ouvrez l’application pour démarrer :',
    url,
    '',
    'À bientôt,',
    'L’équipe Kizumai',
  ].join('\n');

  const html = emailShell({
    title: 'Bienvenue sur Kizumai',
    bodyHtml: `
      <p style="margin:0 0 12px">Bonjour <strong>${escapeHtml(name)}</strong>,</p>
      <p style="margin:0 0 12px">Bienvenue sur <strong>Kizumai</strong>, le propulseur de projet.</p>
      <p style="margin:0 0 12px">Nous vous accompagnons pour clarifier votre idée, structurer votre parcours et avancer concrètement vers le lancement de votre activité.</p>
      <p style="margin:0">Cliquez ci-dessous pour ouvrir l’application et démarrer.</p>
    `,
    ctaLabel: 'Ouvrir Kizumai',
    ctaUrl: url,
  });

  return { subject, text, html };
}
