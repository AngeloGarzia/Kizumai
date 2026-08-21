import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { AppError } from './AppError.js';
import { config } from '../config/index.js';

/**
 * Protection SSRF : refuse localhost, réseaux privés, metadata cloud, IPv6 link-local.
 */

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

function isPrivateIpv4(ip) {
  const n = ipv4ToInt(ip);
  const ranges = [
    [ipv4ToInt('0.0.0.0'), ipv4ToInt('0.255.255.255')],
    [ipv4ToInt('10.0.0.0'), ipv4ToInt('10.255.255.255')],
    [ipv4ToInt('100.64.0.0'), ipv4ToInt('100.127.255.255')],
    [ipv4ToInt('127.0.0.0'), ipv4ToInt('127.255.255.255')],
    [ipv4ToInt('169.254.0.0'), ipv4ToInt('169.254.255.255')],
    [ipv4ToInt('172.16.0.0'), ipv4ToInt('172.31.255.255')],
    [ipv4ToInt('192.0.0.0'), ipv4ToInt('192.0.0.255')],
    [ipv4ToInt('192.168.0.0'), ipv4ToInt('192.168.255.255')],
    [ipv4ToInt('198.18.0.0'), ipv4ToInt('198.19.255.255')],
    [ipv4ToInt('224.0.0.0'), ipv4ToInt('255.255.255.255')],
  ];
  return ranges.some(([a, b]) => n >= a && n <= b);
}

function isPrivateIpv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
  if (normalized.startsWith('fe80')) return true; // link-local
  if (normalized.startsWith('::ffff:')) {
    const v4 = normalized.replace('::ffff:', '');
    if (net.isIP(v4) === 4) return isPrivateIpv4(v4);
  }
  return false;
}

export function isBlockedIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'metadata.azure.com',
]);

/**
 * Valide une URL http(s) contre SSRF (hostname + résolution DNS).
 * @param {string} raw
 * @param {{ allowRelative?: boolean }} opts
 */
export async function assertSafeExternalUrlAsync(raw, { allowRelative = false } = {}) {
  if (!raw || typeof raw !== 'string') {
    throw new AppError('URL invalide', 400);
  }
  const trimmed = raw.trim();

  if (allowRelative && trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    try {
      return new URL(trimmed, config.appUrl).toString();
    } catch {
      throw new AppError('URL invalide', 400);
    }
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError('URL invalide', 400);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError('URL non autorisée (http/https uniquement)', 400);
  }
  if (parsed.username || parsed.password) {
    throw new AppError('URL non autorisée (credentials)', 400);
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new AppError('Hôte non autorisé', 400);
  }

  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new AppError('Adresse IP non autorisée', 400);
    return parsed.toString();
  }

  let records;
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new AppError('Impossible de résoudre l’hôte', 400);
  }

  if (!records.length) throw new AppError('Impossible de résoudre l’hôte', 400);
  for (const rec of records) {
    if (isBlockedIp(rec.address)) {
      throw new AppError('Adresse IP non autorisée (résolution DNS)', 400);
    }
  }

  return parsed.toString();
}

/**
 * Version sync pour chemins relatifs / same-origin app uniquement (pas de fetch).
 */
export function assertSafeExternalUrl(raw, { allowRelative = false } = {}) {
  if (!raw || typeof raw !== 'string') {
    throw new AppError('URL invalide', 400);
  }
  const trimmed = raw.trim();

  if (allowRelative && trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    try {
      const app = new URL(config.appUrl);
      const u = new URL(trimmed, app);
      if (u.origin !== app.origin) throw new AppError('URL hors application', 400);
      return u.toString();
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError('URL invalide', 400);
    }
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError('URL invalide', 400);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError('URL non autorisée', 400);
  }
  const app = new URL(config.appUrl);
  if (parsed.origin !== app.origin) {
    // Sync path : refuse les origines externes (évite SSRF sync sans DNS).
    throw new AppError('URL hors application', 400);
  }
  return parsed.toString();
}
