import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

let transporter = null;

/** Timeouts SMTP — sans ça un serveur injoignable bloque la requête jusqu’au 502 nginx. */
const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
const SMTP_GREETING_TIMEOUT_MS = 10_000;
const SMTP_SOCKET_TIMEOUT_MS = 15_000;
const SMTP_SEND_TIMEOUT_MS = 20_000;

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
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  });
  return transporter;
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} : délai dépassé (${ms}ms)`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
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

      await withTimeout(
        tx.sendMail({
          from: config.email.from,
          to: recipient,
          subject: subj,
          text: text || undefined,
          html: html || undefined,
        }),
        SMTP_SEND_TIMEOUT_MS,
        'SMTP sendMail'
      );
      console.log(`[email] ok à=${recipient} sujet="${subj}"`);
      return { ok: true, skipped: false };
    } catch (err) {
      console.warn(`[email] échec à=${recipient} sujet="${subj}" : ${err.message}`);
      // Transporter potentiellement pourri après timeout réseau — on le recrée au prochain envoi.
      transporter = null;
      return { ok: false, skipped: false, error: err.message || 'send_failed' };
    }
  },
};
