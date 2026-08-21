import { AppError } from '../utils/AppError.js';

const LINKABLE_TYPES = ['project', 'document', 'planner_event', 'company'];

function deriveDisplayName(payload) {
  if (payload.displayName) return payload.displayName;
  const full = [payload.firstName, payload.lastName].filter(Boolean).join(' ').trim();
  return full || payload.organization || payload.email || 'Contact';
}

export function createContactService({
  contactRepository,
  contactLinkRepository,
  projectRepository,
  documentRepository,
  plannerEventRepository,
  companyRepository,
  projectMemoryUpdateService = null,
}) {
  // Vérifie que l'objet cible existe ET appartient à l'utilisateur.
  async function assertEntityOwnership(userId, entityType, entityId) {
    if (!LINKABLE_TYPES.includes(entityType)) {
      throw new AppError(`Type d'entité non supporté : ${entityType}`, 400);
    }

    let ownerId = null;

    if (entityType === 'project') {
      const project = await projectRepository.findById(entityId);
      ownerId = project?.userId ?? null;
    } else if (entityType === 'planner_event') {
      const event = await plannerEventRepository.findById(entityId);
      ownerId = event?.userId ?? null;
    } else if (entityType === 'document') {
      const doc = await documentRepository.findById(entityId);
      if (doc) {
        const project = await projectRepository.findById(doc.projectId);
        ownerId = project?.userId ?? null;
      }
    } else if (entityType === 'company') {
      const company = await companyRepository.findById(entityId);
      if (company) {
        const project = await projectRepository.findById(company.projectId);
        ownerId = project?.userId ?? null;
      }
    }

    if (ownerId == null) throw new AppError('Objet à rattacher introuvable', 404);
    if (ownerId !== userId) throw new AppError('Accès refusé à cet objet', 403);
  }

  return {
    async list(userId) {
      return contactRepository.findByUserId(userId);
    },

    async get(userId, id) {
      const contact = await contactRepository.findById(id);
      if (!contact || contact.userId !== userId) {
        throw new AppError('Contact introuvable', 404);
      }
      return contact;
    },

    async getWithLinks(userId, id) {
      const contact = await this.get(userId, id);
      const links = await contactLinkRepository.findByContactId(id);
      return { ...contact, links };
    },

    async create(userId, payload = {}) {
      if (payload.projectId != null) {
        await assertEntityOwnership(userId, 'project', payload.projectId);
      }
      const contact = await contactRepository.create({
        ...payload,
        userId,
        displayName: deriveDisplayName(payload),
      });

      if (
        projectMemoryUpdateService &&
        contact.projectId &&
        projectMemoryUpdateService.isKeyContactCategory(contact.category)
      ) {
        projectMemoryUpdateService.recordEventSafe({
          projectId: contact.projectId,
          nodeType: 'fact',
          content: `Contact clé (${contact.category}) : ${contact.displayName}`,
          sourceEntityType: 'contact',
          sourceEntityId: contact.id,
          importance: 0.7,
        });
      }

      return contact;
    },

    async update(userId, id, payload = {}) {
      await this.get(userId, id);
      if (payload.projectId != null) {
        await assertEntityOwnership(userId, 'project', payload.projectId);
      }
      return contactRepository.update(id, payload);
    },

    async remove(userId, id) {
      await this.get(userId, id);
      await contactRepository.delete(id);
      return true;
    },

    // ── Liaisons polymorphes ──
    async link(userId, contactId, { entityType, entityId, role, note } = {}) {
      await this.get(userId, contactId);
      await assertEntityOwnership(userId, entityType, entityId);
      return contactLinkRepository.link({ contactId, entityType, entityId, role, note });
    },

    async unlink(userId, contactId, linkId) {
      await this.get(userId, contactId);
      const links = await contactLinkRepository.findByContactId(contactId);
      const target = links.find((l) => l.id === Number(linkId));
      if (!target) throw new AppError('Liaison introuvable', 404);
      await contactLinkRepository.unlink(linkId);
      return true;
    },

    // Tous les contacts rattachés à un objet (document, tâche, projet, société).
    async getContactsForEntity(userId, entityType, entityId) {
      await assertEntityOwnership(userId, entityType, entityId);
      return contactLinkRepository.findContactsForEntity(entityType, entityId);
    },
  };
}
