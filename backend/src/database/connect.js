import pool from './pool.js';
import { runMigrations } from './migrate.js';
import { seedAdminUser } from './seedAdmin.js';

export async function connectDatabase() {
  const client = await pool.connect();

  try {
    await client.query('SELECT 1');
    console.log('[db] Connexion PostgreSQL établie');
  } finally {
    client.release();
  }

  await runMigrations();
  await seedAdminUser();
}

export async function checkDatabaseHealth() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
}
