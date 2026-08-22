import { DocumentProcessingError } from '../services/documentProcessingLimits.js';

/**
 * Exécute une promesse avec timeout ; rejette proprement si dépassé.
 */
export function withProcessingTimeout(promise, timeoutMs, label = 'traitement') {
  if (!timeoutMs || timeoutMs <= 0) return promise;

  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new DocumentProcessingError(`${label} : délai dépassé (${timeoutMs}ms)`, 'timeout'));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
