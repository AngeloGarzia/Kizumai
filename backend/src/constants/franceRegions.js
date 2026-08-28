/** Régions métropolitaines (codes INSEE). */
export const FRANCE_METRO_REGIONS = [
  { code: '11', name: 'Île-de-France' },
  { code: '24', name: 'Centre-Val de Loire' },
  { code: '27', name: 'Bourgogne-Franche-Comté' },
  { code: '28', name: 'Normandie' },
  { code: '32', name: 'Hauts-de-France' },
  { code: '44', name: 'Grand Est' },
  { code: '52', name: 'Pays de la Loire' },
  { code: '53', name: 'Bretagne' },
  { code: '75', name: 'Nouvelle-Aquitaine' },
  { code: '76', name: 'Occitanie' },
  { code: '84', name: 'Auvergne-Rhône-Alpes' },
  { code: '93', name: "Provence-Alpes-Côte d'Azur" },
  { code: '94', name: 'Corse' },
];

const ALIASES = new Map(
  FRANCE_METRO_REGIONS.flatMap((r) => [
    [r.name.toLowerCase(), r.code],
    [r.name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(), r.code],
  ])
);

function normalizeFeasibility(value) {
  const num = Math.round(Number(value));
  if (!Number.isFinite(num)) return 50;
  return Math.min(100, Math.max(0, num));
}

function resolveRegionCode(item) {
  const rawCode = String(item?.code ?? '').trim();
  if (/^\d{1,2}$/.test(rawCode)) {
    return rawCode.padStart(2, '0');
  }
  const name = String(item?.name || item?.nom || '')
    .trim()
    .toLowerCase();
  if (!name) return null;
  if (ALIASES.has(name)) return ALIASES.get(name);
  const folded = name.normalize('NFD').replace(/\p{M}/gu, '');
  if (ALIASES.has(folded)) return ALIASES.get(folded);
  for (const [alias, code] of ALIASES) {
    if (folded.includes(alias) || alias.includes(folded)) return code;
  }
  return null;
}

function normalizeCities(rawCities, cityHint = '') {
  const list = Array.isArray(rawCities) ? rawCities : [];
  const cities = list
    .map((item) => ({
      name: String(item?.name || item?.city || '').trim().slice(0, 120),
      score: normalizeFeasibility(item?.score ?? item?.feasibility),
      rationale: String(item?.rationale || '').trim().slice(0, 300),
    }))
    .filter((item) => item.name);

  const seen = new Set();
  const unique = [];
  for (const city of cities.sort((a, b) => b.score - a.score)) {
    const key = city.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(city);
    if (unique.length >= 5) break;
  }

  if (unique.length === 0 && cityHint) {
    unique.push({ name: cityHint, score: 60, rationale: '' });
  }

  return unique;
}

export function normalizeFranceImplantation(raw) {
  const incoming = Array.isArray(raw?.regions) ? raw.regions : Array.isArray(raw) ? raw : [];
  const byCode = new Map();

  for (const item of incoming) {
    const code = resolveRegionCode(item);
    if (!code) continue;
    const cityHint = String(item?.cityHint || item?.city || '').trim().slice(0, 120);
    byCode.set(code, {
      score: normalizeFeasibility(item?.score ?? item?.feasibility),
      rationale: String(item?.rationale || '').trim().slice(0, 500),
      cityHint,
      cities: normalizeCities(item?.cities, cityHint),
    });
  }

  const regions = FRANCE_METRO_REGIONS.map((meta) => {
    const hit = byCode.get(meta.code);
    return {
      code: meta.code,
      name: meta.name,
      score: hit?.score ?? 50,
      rationale: hit?.rationale || '',
      cityHint: hit?.cityHint || hit?.cities?.[0]?.name || '',
      cities: hit?.cities || [],
    };
  });

  return {
    summary: String(raw?.summary || '').trim().slice(0, 600),
    regions,
  };
}
