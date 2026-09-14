import { config } from '../config/index.js';
import { EmailService } from './EmailService.js';
import { renderPlannerReminder } from '../templates/emails/planner-reminder.js';
import { renderProjectProgress } from '../templates/emails/project-progress.js';
import { renderGenericNotification } from '../templates/emails/generic-notification.js';
import { renderAccountConfirmation } from '../templates/emails/account-confirmation.js';

/**
 * Point d’entrée des emails transactionnels Kizumai.
 * À appeler depuis le worker planner, les stages projet, ou un script de test.
 * Ne fait jamais planter l’app si SMTP échoue.
 */
export const TransactionalMail = {
  async sendMail({ to, subject, html, text }) {
    return EmailService.send({ to, subject, html, text });
  },

  /**
   * Rappel agenda (task / deadline / appointment / reminder).
   * @param {{ to: string, kindLabel?: string, eventTitle: string, when: string, location?: string, description?: string, url?: string }} input
   */
  async sendPlannerReminderEmail(input = {}) {
    const url = input.url || `${config.publicAppUrl}/planner`;
    const { subject, text, html } = renderPlannerReminder({
      kindLabel: input.kindLabel,
      eventTitle: input.eventTitle,
      when: input.when,
      location: input.location,
      description: input.description,
      url,
    });
    return EmailService.send({ to: input.to, subject, text, html });
  },

  /**
   * Progression projet — prêt pour un futur déclencheur stage/tasks.
   * @param {{ to: string, projectTitle: string, stageLabel?: string, percent?: number|null, message?: string, url?: string }} input
   */
  async sendProjectProgressEmail(input = {}) {
    const url = input.url || `${config.publicAppUrl}/`;
    const { subject, text, html } = renderProjectProgress({
      projectTitle: input.projectTitle,
      stageLabel: input.stageLabel,
      percent: input.percent,
      message: input.message,
      url,
    });
    return EmailService.send({ to: input.to, subject, text, html });
  },

  /**
   * Confirmation d’inscription (lien d’activation).
   * @param {{ to: string, name: string, confirmUrl: string, expiresHours?: number }} input
   */
  async sendAccountConfirmationEmail(input = {}) {
    const { subject, text, html } = renderAccountConfirmation({
      name: input.name,
      confirmUrl: input.confirmUrl,
      expiresHours: input.expiresHours,
    });
    return EmailService.send({ to: input.to, subject, text, html });
  },

  async sendGenericNotificationEmail({ to, title, body, url }) {
    const link = url || config.publicAppUrl;
    const { subject, text, html } = renderGenericNotification({
      title,
      body,
      url: link,
    });
    return EmailService.send({ to, subject, text, html });
  },
};
