import { escapeHtml, emailShell } from './render.js';

/**
 * Notification générique (broadcast admin, etc.).
 */
export function renderGenericNotification({ title, body, url }) {
  const subject = String(title || 'Kizumai');
  const textBody = String(body || '');
  const link = String(url || '');
  const text = `${textBody}\n\n${link}`.trim();
  const html = emailShell({
    title: subject,
    bodyHtml: `<p style="margin:0">${escapeHtml(textBody)}</p>`,
    ctaLabel: 'Ouvrir Kizumai',
    ctaUrl: link,
  });
  return { subject, text, html };
}
