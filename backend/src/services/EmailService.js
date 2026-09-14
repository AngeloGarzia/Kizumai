import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

let transporter = null;

function getTransporter() {
  if (!config.email.enabled) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: config.email.user
      ? { user: config.email.user, pass: config.email.password }
      : undefined,
  });
  return transporter;
}

/**
 * Envoi SMTP générique. Ne jette jamais : l’appelant lit `ok` / `skipped` / `error`.
 */
export const EmailService = {
  isConfigured() {
    return config.email.enabled;
  },

  async send({ to, subject, text, html }) {
    const recipient = String(to || '').trim();
    const subj = String(subject || 'Kizumai').trim();

    if (!recipient) {
      console.warn('[email] destinataire manquant — envoi ignoré');
      return { ok: false, skipped: true, error: 'missing_to' };
    }

    // Sans SMTP configuré (typiquement en dev), on trace l'email au lieu de l'envoyer.
    if (!config.email.enabled) {
      console.log(`[email] (non envoyé — SMTP non configuré) à=${recipient} sujet="${subj}"`);
      console.log(`[email] ${text || html || ''}`);
      return { ok: true, skipped: true };
    }

    try {
      const tx = getTransporter();
      if (!tx) {
        console.warn('[email] transporteur indisponible');
        return { ok: false, skipped: true, error: 'no_transporter' };
      }

      await tx.sendMail({
        from: config.email.from,
        to: recipient,
        subject: subj,
        text: text || undefined,
        html: html || undefined,
      });
      console.log(`[email] ok à=${recipient} sujet="${subj}"`);
      return { ok: true, skipped: false };
    } catch (err) {
      console.warn(`[email] échec à=${recipient} sujet="${subj}" : ${err.message}`);
      return { ok: false, skipped: false, error: err.message || 'send_failed' };
    }
  },
};
