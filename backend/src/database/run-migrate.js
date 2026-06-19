import { connectDatabase } from './connect.js';
import pool from './pool.js';

await connectDatabase();
await pool.end();
process.exit(0);
