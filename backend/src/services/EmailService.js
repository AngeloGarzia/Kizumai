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

export const EmailService = {
  isConfigured() {
    return config.email.enabled;
  },

  async send({ to, subject, text, html }) {
    // Sans SMTP configuré (typiquement en dev), on trace l'email au lieu de l'envoyer.
    if (!config.email.enabled) {
      console.log(`[email] (non envoyé — SMTP non configuré) à=${to} sujet="${subject}"`);
      console.log(`[email] ${text || html || ''}`);
      return { skipped: true };
    }

    const tx = getTransporter();
    await tx.sendMail({
      from: config.email.from,
      to,
      subject,
      text,
      html: html || undefined,
    });
    return { skipped: false };
  },
};
