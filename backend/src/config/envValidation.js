import net from 'node:net';

/** Motifs de placeholder / secrets triviaux (jamais logguer la valeur). */
const PLACEHOLDER_PATTERNS = [
  /^CHANGE_ME/i,
  /^change.?me/i,
  /^your.?secret/i,
  /^placeholder$/i,
  /^secret$/i,
  /^password$/i,
  /^redis$/i,
  /^kizumai$/i,
  /^admin$/i,
  /^postgres$/i,
  /^test$/i,
  /^dev-/i,
  /^example/i,
];

const WEAK_JWT_PATTERNS = [
  ...PLACEHOLDER_PATTERNS,
  /kizumai/i,
  /^test/i,
];

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
    [ipv4ToInt('192.168.0.0'), ipv4ToInt('192.168.255.255')],
    [ipv4ToInt('198.18.0.0'), ipv4ToInt('198.19.255.255')],
  ];
  return ranges.some(([a, b]) => n >= a && n <= b);
}

function isPrivateIpv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe80')) return true;
  if (normalized.startsWith('::ffff:')) {
    const v4 = normalized.replace('::ffff:', '');
    if (net.isIP(v4) === 4) return isPrivateIpv4(v4);
  }
  return false;
}

export function isPrivateOrLocalHost(host) {
  const h = String(host || '')
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  const ipVersion = net.isIP(h);
  if (ipVersion === 4) return isPrivateIpv4(h);
  if (ipVersion === 6) return isPrivateIpv6(h);
  return false;
}

/** Hôte Redis considéré comme réseau interne (Docker / loopback). */
export function isInternalRedisHost(host) {
  const h = String(host || '').toLowerCase();
  if (isPrivateOrLocalHost(h)) return true;
  if (h === 'redis' || h === 'kizumai-redis') return true;
  if (h.endsWith('.internal') || h.endsWith('.svc.cluster.local')) return true;
  return false;
}

export function isPlaceholderSecret(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  if (s.length < 8) return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(s));
}

export function isWeakJwtSecret(value) {
  const s = String(value || '');
  if (s.length < 32) return true;
  return WEAK_JWT_PATTERNS.some((re) => re.test(s));
}

/**
 * Parse une URL et exige une origin pure (schéma + host + port optionnel).
 */
export function parsePureOrigin(raw, label = 'URL') {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    throw new Error(`${label} requise`);
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${label} invalide (format URL)`);
  }

  if (parsed.username || parsed.password) {
    throw new Error(`${label} ne doit pas contenir d'identifiants`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`${label} ne doit pas contenir de query ou fragment`);
  }
  if (parsed.pathname && parsed.pathname !== '/') {
    throw new Error(`${label} doit être une origin pure (sans chemin)`);
  }

  return parsed.origin;
}

/**
 * Valide une origin CORS individuelle.
 */
export function validateCorsOriginEntry(raw, { isProd, allowInsecure = false } = {}) {
  const entry = String(raw || '').trim();
  if (!entry) {
    throw new Error('CORS origin vide');
  }
  if (entry === '*') {
    throw new Error('CORS wildcard (*) interdit avec credentials');
  }

  const origin = parsePureOrigin(entry, 'CORS origin');

  if (isProd && !allowInsecure) {
    if (!origin.startsWith('https://')) {
      throw new Error('CORS origin HTTPS requise en production');
    }
    const host = new URL(origin).hostname;
    if (isPrivateOrLocalHost(host)) {
      throw new Error('CORS origin ne doit pas pointer vers localhost ou réseau privé');
    }
  }

  return origin;
}

/**
 * Parse CORS_ORIGIN (mono ou liste séparée par des virgules).
 */
export function parseCorsOrigins(raw, { isProd, allowInsecure = false } = {}) {
  if (!raw?.trim()) {
    if (isProd) {
      throw new Error('CORS_ORIGIN requis en production');
    }
    return 'http://localhost:5173';
  }

  const parts = raw.includes(',')
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : [raw.trim()];

  if (parts.length === 0) {
    throw new Error('CORS_ORIGIN vide');
  }

  const validated = parts.map((p) => validateCorsOriginEntry(p, { isProd, allowInsecure }));

  if (validated.length !== new Set(validated).size) {
    throw new Error('CORS_ORIGIN contient des doublons');
  }

  return validated.length === 1 ? validated[0] : validated;
}

/**
 * Valide APP_URL (origin pure).
 */
export function validateAppUrl(raw, { isProd, allowInsecure = false, fallback = null } = {}) {
  const value = raw?.trim() || fallback?.trim();
  if (!value) {
    if (isProd) {
      throw new Error('APP_URL requise en production');
    }
    return 'http://localhost:5173';
  }

  const origin = parsePureOrigin(value, 'APP_URL');

  if (isProd && !allowInsecure) {
    if (!origin.startsWith('https://')) {
      throw new Error('APP_URL HTTPS requise en production');
    }
    const host = new URL(origin).hostname;
    if (isPrivateOrLocalHost(host)) {
      throw new Error('APP_URL ne doit pas pointer vers localhost ou réseau privé');
    }
  }

  return origin;
}

function parseRedisUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('REDIS_URL invalide');
  }

  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new Error('REDIS_URL doit utiliser le schéma redis:// ou rediss://');
  }

  const password = parsed.password || '';
  const hasAuth = Boolean(password || (parsed.username && parsed.username !== 'default'));
  const host = parsed.hostname;

  return { password, hasAuth, host, raw: trimmed };
}

/**
 * Valide REDIS_URL (auth + mot de passe fort en prod).
 */
export function validateRedisUrl(raw, { isProd, allowInsecure = false } = {}) {
  if (!raw?.trim()) {
    return '';
  }

  const info = parseRedisUrl(raw);

  if (!info.hasAuth) {
    if (isProd && !allowInsecure) {
      throw new Error('REDIS_URL sans mot de passe interdit en production');
    }
    if (!isInternalRedisHost(info.host)) {
      throw new Error('REDIS_URL sans authentification interdit hors réseau interne');
    }
    return info.raw;
  }

  if (isProd && isPlaceholderSecret(info.password)) {
    throw new Error('REDIS_URL utilise un mot de passe placeholder ou trop faible');
  }

  return info.raw;
}

function extractDatabasePassword(dbUrl) {
  try {
    const u = new URL(dbUrl);
    return u.password || '';
  } catch {
    return '';
  }
}

/**
 * Validation complète de l'environnement production au démarrage.
 */
export function validateProductionEnvironment(env) {
  const isProd = env.NODE_ENV === 'production';
  if (!isProd) return;

  const allowInsecureCors = env.ALLOW_INSECURE_CORS === 'true';
  const allowInsecureRedis = env.ALLOW_INSECURE_REDIS === 'true';

  const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'CORS_ORIGIN', 'DATABASE_URL', 'APP_URL', 'REDIS_URL'];
  const missing = required.filter((key) => !String(env[key] || '').trim());
  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes en production : ${missing.join(', ')}`);
  }

  const access = env.JWT_ACCESS_SECRET;
  const refresh = env.JWT_REFRESH_SECRET;
  if (isWeakJwtSecret(access) || isWeakJwtSecret(refresh)) {
    throw new Error('Secrets JWT trop faibles en production (min. 32 caractères, non triviaux)');
  }
  if (access === refresh) {
    throw new Error('JWT_ACCESS_SECRET et JWT_REFRESH_SECRET doivent être distincts');
  }

  parseCorsOrigins(env.CORS_ORIGIN, { isProd: true, allowInsecure: allowInsecureCors });
  validateAppUrl(env.APP_URL, { isProd: true, allowInsecure: allowInsecureCors });

  const dbPass = extractDatabasePassword(env.DATABASE_URL);
  if (
    isPlaceholderSecret(dbPass) ||
    /:(kizumai|password|postgres|admin)@/i.test(env.DATABASE_URL) ||
    /CHANGE_ME/i.test(env.DATABASE_URL)
  ) {
    throw new Error('DATABASE_URL semble utiliser un mot de passe par défaut ou placeholder');
  }

  validateRedisUrl(env.REDIS_URL, { isProd: true, allowInsecure: allowInsecureRedis });
}
