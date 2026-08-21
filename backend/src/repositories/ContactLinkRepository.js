import pool from '../database/pool.js';
import { mapContact } from './ContactRepository.js';

export const mapContactLink = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    contactId: row.contact_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    role: row.role,
    note: row.note,
    createdAt: row.created_at,
  };
};

export const ContactLinkRepository = {
  // Idempotent : (contact_id, entity_type, entity_id) est unique.
  async link({ contactId, entityType, entityId, role = null, note = null }) {
    const { rows } = await pool.query(
      `INSERT INTO contact_links (contact_id, entity_type, entity_id, role, note)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (contact_id, entity_type, entity_id)
       DO UPDATE SET role = EXCLUDED.role, note = EXCLUDED.note
       RETURNING *`,
      [Number(contactId), entityType, Number(entityId), role, note]
    );
    return mapContactLink(rows[0]);
  },

  async findByContactId(contactId) {
    const { rows } = await pool.query(
      'SELECT * FROM contact_links WHERE contact_id = $1 ORDER BY id ASC',
      [Number(contactId)]
    );
    return rows.map(mapContactLink);
  },

  // Contacts rattachés à un objet donné (join direct pour renvoyer la fiche + le rôle).
  async findContactsForEntity(entityType, entityId) {
    const { rows } = await pool.query(
      `SELECT c.*, cl.role AS link_role, cl.note AS link_note, cl.id AS link_id
       FROM contact_links cl
       JOIN contacts c ON c.id = cl.contact_id
       WHERE cl.entity_type = $1 AND cl.entity_id = $2
       ORDER BY c.id DESC`,
      [entityType, Number(entityId)]
    );
    return rows.map((row) => ({
      ...mapContact(row),
      link: { id: row.link_id, role: row.link_role, note: row.link_note },
    }));
  },

  async unlink(id) {
    const { rowCount } = await pool.query('DELETE FROM contact_links WHERE id = $1', [Number(id)]);
    return rowCount > 0;
  },
};

