import { emailShell, escapeHtml } from './render.js';

/**
 * Confirmation de création de compte.
 * @param {{ name: string, confirmUrl: string, expiresHours?: number }} vars
 */
export function renderAccountConfirmation(vars = {}) {
  const name = String(vars.name || 'bonjour').trim() || 'bonjour';
  const confirmUrl = String(vars.confirmUrl || '');
  const expiresHours = Number(vars.expiresHours) || 48;

  const subject = 'Confirmez votre compte Kizumai';
  const text = [
    `Bonjour ${name},`,
    '',
    'Merci pour votre inscription sur Kizumai.',
    'Pour activer votre compte, ouvrez ce lien :',
    confirmUrl,
    '',
    `Ce lien expire dans ${expiresHours} heures.`,
    '',
    'Si vous n’êtes pas à l’origine de cette inscription, ignorez cet email.',
  ].join('\n');

  const html = emailShell({
    title: 'Confirmez votre compte',
    bodyHtml: `
      <p style="margin:0 0 12px">Bonjour <strong>${escapeHtml(name)}</strong>,</p>
      <p style="margin:0 0 12px">Merci pour votre inscription sur Kizumai.</p>
      <p style="margin:0 0 12px">Cliquez sur le bouton ci-dessous pour <strong>activer votre compte</strong>. Sans cette confirmation, vous ne pourrez pas vous connecter.</p>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#5c4a56;word-break:break-all">
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:<br />
        <a href="${escapeHtml(confirmUrl)}" style="color:#3b1f33">${escapeHtml(confirmUrl)}</a>
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:#7a6674">Ce lien expire dans ${expiresHours}&nbsp;heures. Si vous n’êtes pas à l’origine de cette inscription, ignorez cet email.</p>
    `,
    ctaLabel: 'Confirmer mon email',
    ctaUrl: confirmUrl,
  });

  return { subject, text, html };
}
