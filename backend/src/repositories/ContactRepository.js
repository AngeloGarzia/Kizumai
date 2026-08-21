import pool from '../database/pool.js';

export const mapContact = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    contactType: row.contact_type,
    category: row.category,

    civility: row.civility,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    jobTitle: row.job_title,
    organization: row.organization,
    siren: row.siren,
    vatNumber: row.vat_number,
    avatarUrl: row.avatar_url,

    email: row.email,
    phone: row.phone,
    mobile: row.mobile,
    website: row.website,
    emails: row.emails ?? [],
    phones: row.phones ?? [],
    socialLinks: row.social_links ?? {},

    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    postalCode: row.postal_code,
    city: row.city,
    region: row.region,
    country: row.country,

    birthday: row.birthday,
    preferredChannel: row.preferred_channel,
    tags: row.tags ?? [],
    notes: row.notes,
    isFavorite: row.is_favorite,
    source: row.source,
    metadata: row.metadata ?? {},

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const UPDATABLE = {
  projectId: 'project_id',
  contactType: 'contact_type',
  category: 'category',
  civility: 'civility',
  firstName: 'first_name',
  lastName: 'last_name',
  displayName: 'display_name',
  jobTitle: 'job_title',
  organization: 'organization',
  siren: 'siren',
  vatNumber: 'vat_number',
  avatarUrl: 'avatar_url',
  email: 'email',
  phone: 'phone',
  mobile: 'mobile',
  website: 'website',
  addressLine1: 'address_line1',
  addressLine2: 'address_line2',
  postalCode: 'postal_code',
  city: 'city',
  region: 'region',
  country: 'country',
  birthday: 'birthday',
  preferredChannel: 'preferred_channel',
  notes: 'notes',
  isFavorite: 'is_favorite',
  source: 'source',
};

const JSON_FIELDS = {
  emails: 'emails',
  phones: 'phones',
  socialLinks: 'social_links',
  tags: 'tags',
  metadata: 'metadata',
};

export const ContactRepository = {
  async create(data = {}) {
    const {
      userId,
      projectId = null,
      contactType = 'person',
      category = null,
      civility = null,
      firstName = null,
      lastName = null,
      displayName = null,
      jobTitle = null,
      organization = null,
      siren = null,
      vatNumber = null,
      email = null,
      phone = null,
      mobile = null,
      website = null,
      emails = [],
      phones = [],
      socialLinks = {},
      addressLine1 = null,
      addressLine2 = null,
      postalCode = null,
      city = null,
      region = null,
      country = 'FR',
      birthday = null,
      preferredChannel = null,
      tags = [],
      notes = null,
      isFavorite = false,
      source = 'manual',
      metadata = {},
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO contacts (
         user_id, project_id, contact_type, category,
         civility, first_name, last_name, display_name, job_title, organization, siren, vat_number,
         email, phone, mobile, website, emails, phones, social_links,
         address_line1, address_line2, postal_code, city, region, country,
         birthday, preferred_channel, tags, notes, is_favorite, source, metadata
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7, $8, $9, $10, $11, $12,
         $13, $14, $15, $16, $17, $18, $19,
         $20, $21, $22, $23, $24, $25,
         $26, $27, $28, $29, $30, $31, $32
       ) RETURNING *`,
      [
        userId,
        projectId,
        contactType,
        category,
        civility,
        firstName,
        lastName,
        displayName,
        jobTitle,
        organization,
        siren,
        vatNumber,
        email,
        phone,
        mobile,
        website,
        JSON.stringify(emails),
        JSON.stringify(phones),
        JSON.stringify(socialLinks),
        addressLine1,
        addressLine2,
        postalCode,
        city,
        region,
        country,
        birthday,
        preferredChannel,
        JSON.stringify(tags),
        notes,
        isFavorite,
        source,
        JSON.stringify(metadata),
      ]
    );
    return mapContact(rows[0]);
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM contacts WHERE id = $1', [Number(id)]);
    return mapContact(rows[0]);
  },

  async findByUserId(userId) {
    const { rows } = await pool.query(
      'SELECT * FROM contacts WHERE user_id = $1 ORDER BY lower(display_name) ASC NULLS LAST, id DESC',
      [Number(userId)]
    );
    return rows.map(mapContact);
  },

  async findByProjectId(projectId) {
    const { rows } = await pool.query(
      'SELECT * FROM contacts WHERE project_id = $1 ORDER BY id DESC',
      [Number(projectId)]
    );
    return rows.map(mapContact);
  },

  async update(id, data = {}) {
    const setClauses = [];
    const values = [Number(id)];
    let i = 2;

    for (const [key, col] of Object.entries(UPDATABLE)) {
      if (data[key] !== undefined) {
        setClauses.push(`${col} = $${i}`);
        values.push(data[key]);
        i += 1;
      }
    }
    for (const [key, col] of Object.entries(JSON_FIELDS)) {
      if (data[key] !== undefined) {
        setClauses.push(`${col} = $${i}`);
        values.push(JSON.stringify(data[key]));
        i += 1;
      }
    }

    if (setClauses.length === 0) return this.findById(id);

    const { rows } = await pool.query(
      `UPDATE contacts SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      values
    );
    return mapContact(rows[0]);
  },

  async delete(id) {
    const { rowCount } = await pool.query('DELETE FROM contacts WHERE id = $1', [Number(id)]);
    return rowCount > 0;
  },
};

