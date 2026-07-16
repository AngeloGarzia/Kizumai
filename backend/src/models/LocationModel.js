import pool from '../database/pool.js';

export const mapLocation = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    postalCode: row.postal_code,
    city: row.city,
    region: row.region,
    department: row.department,
    country: row.country,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    geoPlaceId: row.geo_place_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const LocationModel = {
  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM locations WHERE id = $1', [Number(id)]);
    return mapLocation(rows[0]);
  },

  async findAll() {
    const { rows } = await pool.query('SELECT * FROM locations ORDER BY label ASC');
    return rows.map(mapLocation);
  },

  async findOrCreate({
    label,
    addressLine1 = null,
    addressLine2 = null,
    postalCode = null,
    city = null,
    region = null,
    department = null,
    country = 'FR',
    latitude = null,
    longitude = null,
    geoPlaceId = null,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO locations
         (label, address_line1, address_line2, postal_code, city, region, department, country, latitude, longitude, geo_place_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (lower(label)) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [
        label,
        addressLine1,
        addressLine2,
        postalCode,
        city,
        region,
        department,
        country,
        latitude,
        longitude,
        geoPlaceId,
      ]
    );
    return mapLocation(rows[0]);
  },

  async update(id, fields) {
    const { rows } = await pool.query(
      `UPDATE locations
       SET address_line1 = COALESCE($2, address_line1),
           address_line2 = COALESCE($3, address_line2),
           postal_code = COALESCE($4, postal_code),
           city = COALESCE($5, city),
           region = COALESCE($6, region),
           department = COALESCE($7, department),
           country = COALESCE($8, country),
           latitude = COALESCE($9, latitude),
           longitude = COALESCE($10, longitude),
           geo_place_id = COALESCE($11, geo_place_id),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        Number(id),
        fields.addressLine1 ?? null,
        fields.addressLine2 ?? null,
        fields.postalCode ?? null,
        fields.city ?? null,
        fields.region ?? null,
        fields.department ?? null,
        fields.country ?? null,
        fields.latitude ?? null,
        fields.longitude ?? null,
        fields.geoPlaceId ?? null,
      ]
    );
    return mapLocation(rows[0]);
  },
};
