import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const root = path.resolve('backend/src/database/migrations');
const outPath = path.resolve('docs/PROMPTS_IA.md');

const files = (await readdir(root)).filter((f) => f.endsWith('.sql')).sort();
/** @type {Map<string, { name: string, role: string, content: string, source: string }>} */
const prompts = new Map();

function unescapeSql(s) {
  return String(s).replace(/''/g, "'");
}

/** Tous les INSERT (clé, nom, rôle, $prompt$…$prompt$) — ordre fichier. */
function applyDollarInserts(sql, file) {
  const parts = sql.split(/INSERT\s+INTO\s+ai_prompts/i);
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i];
    const end = chunk.search(/\)\s*ON CONFLICT/i);
    const block = end >= 0 ? chunk.slice(0, end + 1) : chunk;
    const re =
      /\(\s*'([^']+)'\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*\$prompt\$([\s\S]*?)\$prompt\$\s*\)/g;
    let r;
    while ((r = re.exec(block))) {
      prompts.set(r[1], {
        name: unescapeSql(r[2]),
        role: unescapeSql(r[3]),
        content: r[4],
        source: file,
      });
    }
  }
}

/** INSERT avec content entre quotes simples (prompts courts). */
function applyQuotedInserts(sql, file) {
  const insertMatch = sql.match(
    /INSERT\s+INTO\s+ai_prompts\s*\(\s*prompt_key\s*,\s*name\s*,\s*role\s*,\s*content\s*\)\s*VALUES\s*([\s\S]*?)ON CONFLICT/i
  );
  if (!insertMatch) return;
  const block = insertMatch[1];
  // Uniquement les lignes sans $prompt$ (déjà couvertes autrement)
  if (block.includes('$prompt$')) return;
  const re =
    /\(\s*'([^']+)'\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*\)/g;
  let r;
  while ((r = re.exec(block))) {
    prompts.set(r[1], {
      name: unescapeSql(r[2]),
      role: unescapeSql(r[3]),
      content: unescapeSql(r[4]),
      source: file,
    });
  }
}

function applyUpdates(sql, file) {
  // UPDATE … content = $prompt$…$prompt$ … WHERE prompt_key = '…'
  const re =
    /UPDATE\s+ai_prompts\s+SET\s+([\s\S]*?)WHERE\s+prompt_key\s*=\s*'([^']+)'/gi;
  let m;
  while ((m = re.exec(sql))) {
    const setClause = m[1];
    const key = m[2];
    const contentMatch = setClause.match(/content\s*=\s*\$prompt\$([\s\S]*?)\$prompt\$/i);
    const nameMatch = setClause.match(/\bname\s*=\s*'((?:[^']|'')*)'/i);
    const roleMatch = setClause.match(/\brole\s*=\s*'((?:[^']|'')*)'/i);
    const prev = prompts.get(key) || { name: key, role: 'user', content: '', source: file };
    if (contentMatch || nameMatch || roleMatch) {
      prompts.set(key, {
        name: nameMatch ? unescapeSql(nameMatch[1]) : prev.name,
        role: roleMatch ? unescapeSql(roleMatch[1]) : prev.role,
        content: contentMatch ? contentMatch[1] : prev.content,
        source: file,
      });
    }
  }

  const rename = sql.match(
    /SET\s+prompt_key\s*=\s*'([^']+)'[\s\S]*?WHERE\s+prompt_key\s*=\s*'([^']+)'/i
  );
  if (rename && /ai_prompts/i.test(sql)) {
    const [, neu, alt] = rename;
    if (prompts.has(alt)) {
      const v = prompts.get(alt);
      prompts.delete(alt);
      prompts.set(neu, { ...v, source: file });
    }
  }
}

for (const file of files) {
  const sql = await readFile(path.join(root, file), 'utf8');
  applyDollarInserts(sql, file);
  applyQuotedInserts(sql, file);
  applyUpdates(sql, file);
}

const USAGE = {
  idee_system: 'Système — complétion idée (quoi / ou / budget)',
  project_user: 'Créer son avenir — propositions de business (+ modes ancrage)',
  lieux: 'Créer son avenir — propositions de lieux (mode fixe)',
  budget: 'Créer son avenir — 3/4 propositions budget',
  formation: 'Créer son avenir — suggestions de formations',
  carte_implantation: 'Carte France — scores par région',
  ville_implantation: 'Évaluation d’une ville d’implantation',
  document_scan: 'Scan Fabulous d’un document (résumé, contacts, dates, adresses)',
  memory_snapshot: 'Mémoire projet — synthèse snapshot',
  memory_recall: 'Mémoire projet — rappel de situation',
  project_preview_analysis: 'Aperçu projet — analyse Fabulous neutre',
  project_reorientation: 'Réorientation projet après scan / contexte',
  project_assistant: 'Assistant Fabulous en arrière-plan (checkup)',
  project_audit: 'Audit expert viabilité / rentabilité',
  fabulous_page_guide: 'Guide Fabulous contextualisé par page',
  fabulous_task_checklist: 'Checklist Fabulous d’une tâche de stage',
  ai_trusted_system: 'Système — couche confiance / garde-fous',
  ai_json_system: 'Système — forcer réponses JSON',
  ai_json_retry: 'Système — retry JSON invalide',
  ai_france_system_extra: 'Système — extra carte France',
  ai_memory_context_prefix: 'Système — préfixe injection mémoire',
};

const EXPECTED = Object.keys(USAGE);
const missing = EXPECTED.filter((k) => !prompts.has(k));
if (missing.length) {
  console.warn('Missing expected keys:', missing.join(', '));
}

const keys = [...prompts.keys()].sort((a, b) => a.localeCompare(b));

const lines = [];
lines.push('# Prompts IA Kizumai');
lines.push('');
lines.push(
  '> Inventaire reconstruit depuis les migrations SQL (`backend/src/database/migrations`).'
);
lines.push(
  '> En production, la source de vérité est la table `ai_prompts` (éditable via Admin).'
);
lines.push(
  '> Pour régénérer : `node scripts/export-ai-prompts.mjs`'
);
lines.push('');
lines.push(`Généré le ${new Date().toISOString().slice(0, 10)} — **${keys.length} prompts**.`);
lines.push('');
lines.push('## Sommaire');
lines.push('');
for (const key of keys) {
  const p = prompts.get(key);
  const usage = USAGE[key] ? ` — ${USAGE[key]}` : '';
  lines.push(`- [\`${key}\`](#${key}) — ${p.name}${usage}`);
}
lines.push('');

for (const key of keys) {
  const p = prompts.get(key);
  lines.push('---');
  lines.push('');
  lines.push(`## \`${key}\``);
  lines.push('');
  lines.push('| | |');
  lines.push('|---|---|');
  lines.push(`| **Nom** | ${p.name} |`);
  lines.push(`| **Rôle** | \`${p.role}\` |`);
  lines.push(`| **Dernière migration** | \`${p.source}\` |`);
  if (USAGE[key]) lines.push(`| **Usage** | ${USAGE[key]} |`);
  lines.push('');
  lines.push('```text');
  lines.push(p.content.trimEnd());
  lines.push('```');
  lines.push('');
}

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, lines.join('\n'), 'utf8');
console.log(`Wrote ${outPath} (${keys.length} prompts)`);
console.log(keys.join('\n'));
