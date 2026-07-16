import { ContactModel } from '../models/ContactModel.js';
import { ContactLinkModel } from '../models/ContactLinkModel.js';
import { ProjectModel } from '../models/ProjectModel.js';
import { DocumentModel } from '../models/DocumentModel.js';
import { PlannerEventModel } from '../models/PlannerEventModel.js';
import { CompanyModel } from '../models/CompanyModel.js';
import { AppError } from '../utils/AppError.js';

const LINKABLE_TYPES = ['project', 'document', 'planner_event', 'company'];

function deriveDisplayName(payload) {
  if (payload.displayName) return payload.displayName;
  const full = [payload.firstName, payload.lastName].filter(Boolean).join(' ').trim();
  return full || payload.organization || payload.email || 'Contact';
}

// Vérifie que l'objet cible existe ET appartient à l'utilisateur.
async function assertEntityOwnership(userId, entityType, entityId) {
  if (!LINKABLE_TYPES.includes(entityType)) {
    throw new AppError(`Type d'entité non supporté : ${entityType}`, 400);
  }

  let ownerId = null;

  if (entityType === 'project') {
    const project = await ProjectModel.findById(entityId);
    ownerId = project?.userId ?? null;
  } else if (entityType === 'planner_event') {
    const event = await PlannerEventModel.findById(entityId);
    ownerId = event?.userId ?? null;
  } else if (entityType === 'document') {
    const doc = await DocumentModel.findById(entityId);
    if (doc) {
      const project = await ProjectModel.findById(doc.projectId);
      ownerId = project?.userId ?? null;
    }
  } else if (entityType === 'company') {
    const company = await CompanyModel.findById(entityId);
    if (company) {
      const project = await ProjectModel.findById(company.projectId);
      ownerId = project?.userId ?? null;
    }
  }

  if (ownerId == null) throw new AppError('Objet à rattacher introuvable', 404);
  if (ownerId !== userId) throw new AppError('Accès refusé à cet objet', 403);
}

export const ContactService = {
  async list(userId) {
    return ContactModel.findByUserId(userId);
  },

  async get(userId, id) {
    const contact = await ContactModel.findById(id);
    if (!contact || contact.userId !== userId) {
      throw new AppError('Contact introuvable', 404);
    }
    return contact;
  },

  async getWithLinks(userId, id) {
    const contact = await this.get(userId, id);
    const links = await ContactLinkModel.findByContactId(id);
    return { ...contact, links };
  },

  async create(userId, payload = {}) {
    if (payload.projectId != null) {
      await assertEntityOwnership(userId, 'project', payload.projectId);
    }
    return ContactModel.create({
      ...payload,
      userId,
      displayName: deriveDisplayName(payload),
    });
  },

  async update(userId, id, payload = {}) {
    await this.get(userId, id);
    if (payload.projectId != null) {
      await assertEntityOwnership(userId, 'project', payload.projectId);
    }
    return ContactModel.update(id, payload);
  },

  async remove(userId, id) {
    await this.get(userId, id);
    await ContactModel.delete(id);
    return true;
  },

  // ── Liaisons polymorphes ──
  async link(userId, contactId, { entityType, entityId, role, note } = {}) {
    await this.get(userId, contactId);
    await assertEntityOwnership(userId, entityType, entityId);
    return ContactLinkModel.link({ contactId, entityType, entityId, role, note });
  },

  async unlink(userId, contactId, linkId) {
    await this.get(userId, contactId);
    const links = await ContactLinkModel.findByContactId(contactId);
    const target = links.find((l) => l.id === Number(linkId));
    if (!target) throw new AppError('Liaison introuvable', 404);
    await ContactLinkModel.unlink(linkId);
    return true;
  },

  // Tous les contacts rattachés à un objet (document, tâche, projet, société).
  async getContactsForEntity(userId, entityType, entityId) {
    await assertEntityOwnership(userId, entityType, entityId);
    return ContactLinkModel.findContactsForEntity(entityType, entityId);
  },
};
