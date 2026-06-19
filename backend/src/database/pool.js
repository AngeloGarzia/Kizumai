import pg from 'pg';
import { config } from '../config/index.js';

const pool = new pg.Pool({
  connectionString: config.database.url,
  ssl: config.database.ssl,
  max: config.database.max,
});

pool.on('error', (err) => {
  console.error('[db] Erreur inattendue sur le pool PostgreSQL', err);
});

export default pool;
