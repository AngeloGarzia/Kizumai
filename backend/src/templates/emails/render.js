/** Helpers de rendu email (pas de moteur externe — aligné sur NotificationService). */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function emailShell({ title, bodyHtml, ctaLabel, ctaUrl }) {
  const safeTitle = escapeHtml(title);
  const safeCta = escapeHtml(ctaLabel || 'Ouvrir Kizumai');
  const safeUrl = escapeHtml(ctaUrl || '#');
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f6f3f7;font-family:system-ui,Segoe UI,Arial,sans-serif;color:#2a1520">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f3f7;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eadfe8">
        <tr><td style="background:#3b1f33;padding:18px 24px">
          <p style="margin:0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#d8c4d2">Kizumai</p>
          <h1 style="margin:8px 0 0;font-size:20px;line-height:1.3;color:#ffffff">${safeTitle}</h1>
        </td></tr>
        <tr><td style="padding:24px;font-size:15px;line-height:1.55;color:#2a1520">
          ${bodyHtml}
          <p style="margin:24px 0 0">
            <a href="${safeUrl}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#a8c82a;color:#1f2a0a;text-decoration:none;font-weight:600">${safeCta}</a>
          </p>
        </td></tr>
        <tr><td style="padding:14px 24px;background:#faf7fb;font-size:12px;color:#7a6674">
          Message automatique Kizumai — ne pas répondre directement à cet email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
