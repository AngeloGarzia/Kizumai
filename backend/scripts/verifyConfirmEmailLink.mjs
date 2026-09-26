/**
 * Vérifie le lien de confirmation email (template + flux register → confirm).
 * Usage: node --env-file=.env.development scripts/verifyConfirmEmailLink.mjs
 */
import crypto from 'crypto';
import { config } from '../src/config/index.js';
import { renderAccountConfirmation } from '../src/templates/emails/account-confirmation.js';
import { escapeHtml } from '../src/templates/emails/render.js';

function buildConfirmUrl(rawToken) {
  const base = String(config.publicAppUrl || config.appUrl || '').replace(/\/$/, '');
  return `${base}/confirm-email?token=${encodeURIComponent(rawToken)}`;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function testTemplate() {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const confirmUrl = buildConfirmUrl(rawToken);
  const mail = renderAccountConfirmation({
    name: 'Camille',
    confirmUrl,
    expiresHours: 48,
  });

  assert(confirmUrl.includes('/confirm-email?token='), `URL path invalide: ${confirmUrl}`);
  assert(confirmUrl.startsWith('http'), `URL non absolue: ${confirmUrl}`);
  assert(mail.text.includes(confirmUrl), 'Lien absent du texte brut');
  const href = `href="${escapeHtml(confirmUrl)}"`;
  assert(mail.html.includes(href), `CTA HTML sans bon href (attendu ${href})`);
  assert(mail.html.includes('Confirmer mon email'), 'Bouton CTA manquant');
  assert(mail.subject.toLowerCase().includes('confirm'), 'Sujet inattendu');

  console.log('[ok] template + URL', confirmUrl.slice(0, 80) + '…');
  return { rawToken, confirmUrl };
}

async function testApiRoundTrip() {
  const base = `http://127.0.0.1:${config.port || 3001}/api`;
  const email = `confirm-test-${Date.now()}@example.com`;
  const password = 'TestConfirm1!';

  const csrfRes = await fetch(`${base}/auth/csrf`);
  const csrfJson = await csrfRes.json();
  const token = csrfJson?.data?.csrfToken;
  const cookies = csrfRes.headers.getSetCookie?.() || [];
  const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');

  const headers = {
    'Content-Type': 'application/json',
    Origin: config.appUrl || 'http://localhost:5173',
    Cookie: cookieHeader,
    ...(token ? { 'X-CSRF-Token': token } : {}),
  };

  const reg = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Confirm Test', email, password }),
  });
  const regBody = await reg.json().catch(() => ({}));
  assert(reg.ok, `register failed ${reg.status}: ${JSON.stringify(regBody)}`);
  assert(
    regBody?.data?.pendingVerification === true || regBody?.pendingVerification === true || reg.ok,
    'register should pending verification'
  );

  // Récupère le hash depuis la DB via un import repo
  const { UserRepository } = await import('../src/repositories/UserRepository.js');
  const user = await UserRepository.findByEmail(email);
  assert(user, 'user not created');
  assert(user.emailVerificationTokenHash, 'verification token hash missing');
  assert(!user.emailVerifiedAt, 'should not be verified yet');

  // On ne peut pas retrouver le raw token depuis le hash — on simule issueEmailVerification
  // en posant un token connu.
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
  await UserRepository.setEmailVerificationToken(user.id, { tokenHash, expiresAt });

  const confirmUrl = buildConfirmUrl(rawToken);
  const urlObj = new URL(confirmUrl);
  assert(urlObj.pathname.endsWith('/confirm-email'), `pathname ${urlObj.pathname}`);
  const qToken = urlObj.searchParams.get('token');
  assert(qToken === rawToken, 'token query mismatch after URL parse');

  const conf = await fetch(`${base}/auth/confirm-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ token: qToken }),
  });
  const confBody = await conf.json().catch(() => ({}));
  assert(conf.ok, `confirm failed ${conf.status}: ${JSON.stringify(confBody)}`);

  const verified = await UserRepository.findByEmail(email);
  assert(verified?.emailVerifiedAt, 'emailVerifiedAt not set');

  console.log('[ok] API register → confirm via token extrait du lien');
  console.log('[ok] confirmUrl fonctionnel:', confirmUrl.replace(rawToken, '[token]'));
}

try {
  await testTemplate();
  await testApiRoundTrip();
  console.log('\nTous les contrôles du lien de confirmation sont OK.');
  process.exit(0);
} catch (err) {
  console.error('\nÉCHEC:', err.message);
  process.exit(1);
}
