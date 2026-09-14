/**
 * Test manuel d’envoi email en dev.
 *
 * Usage :
 *   node --env-file=.env.development scripts/testMail.js vous@exemple.com
 *   npm run test:mail -- vous@exemple.com
 *
 * Sans SMTP_HOST : l’email est seulement loggé (mode dev).
 */
import { EmailService } from '../src/services/EmailService.js';
import { TransactionalMail } from '../src/services/TransactionalMail.js';
import { config } from '../src/config/index.js';

const to = process.argv[2] || process.env.TEST_MAIL_TO;

if (!to) {
  console.error('Usage: npm run test:mail -- <destinataire@exemple.com>');
  process.exit(1);
}

console.log(`[testMail] SMTP enabled=${EmailService.isConfigured()} host=${config.email.host || '(vide)'}`);
console.log(`[testMail] FROM=${config.email.from}`);
console.log(`[testMail] TO=${to}`);

const reminder = await TransactionalMail.sendPlannerReminderEmail({
  to,
  kindLabel: 'Échéance',
  eventTitle: 'Test Kizumai — rappel agenda',
  when: new Date().toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }),
  location: 'Bureau',
  description: 'Email de test généré par scripts/testMail.js',
  url: `${config.publicAppUrl}/planner`,
});

console.log('[testMail] reminder →', reminder);

const progress = await TransactionalMail.sendProjectProgressEmail({
  to,
  projectTitle: 'Projet démo Kizumai',
  stageLabel: 'Étude de marché',
  percent: 35,
  message: 'Test de progression — aucun impact métier.',
  url: `${config.publicAppUrl}/`,
});

console.log('[testMail] progress →', progress);

const ok = (reminder.ok || reminder.skipped) && (progress.ok || progress.skipped);
process.exit(ok ? 0 : 1);
