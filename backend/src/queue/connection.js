import IORedis from 'ioredis';
import { config } from '../config/index.js';

let connection = null;

/**
 * Connexion Redis partagée (ioredis) pour BullMQ.
 * Renvoie `null` si la file d'attente est désactivée (pas d'URL Redis).
 *
 * `maxRetriesPerRequest: null` est imposé par BullMQ pour les workers.
 */
export function getRedisConnection() {
  if (!config.queue.enabled) return null;
  if (connection) return connection;

  connection = new IORedis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times) {
      // Backoff plafonné à 5 s pour ne pas marmarteler Redis.
      return Math.min(times * 200, 5000);
    },
  });

  connection.on('error', (err) => {
    console.warn(`[queue] Erreur de connexion Redis : ${err.message}`);
  });
  connection.on('connect', () => {
    console.log('[queue] Connexion Redis établie');
  });

  return connection;
}

export async function closeRedisConnection() {
  if (connection) {
    await connection.quit().catch(() => {});
    connection = null;
  }
}
