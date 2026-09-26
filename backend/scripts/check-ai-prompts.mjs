import pool from '../src/database/pool.js';

const EXPECTED = [
  'idee_system',
  'project_user',
  'lieux',
  'carte_implantation',
  'ville_implantation',
  'budget',
  'formation',
  'document_scan',
  'memory_snapshot',
  'memory_recall',
  'ai_trusted_system',
  'ai_json_system',
  'ai_json_retry',
  'ai_france_system_extra',
  'ai_memory_context_prefix',
  'ai_fabulous_voice',
  'project_preview_analysis',
  'project_reorientation',
  'fabulous_page_guide',
  'fabulous_task_checklist',
  'project_assistant',
  'project_audit',
  'business_competition',
];

const { rows } = await pool.query(`
  SELECT prompt_key, name, role,
         length(content) AS len,
         CASE WHEN content IS NULL OR btrim(content) = '' THEN true ELSE false END AS empty,
         updated_at
  FROM ai_prompts
  ORDER BY prompt_key
`);

const byKey = new Map(rows.map((r) => [r.prompt_key, r]));
console.log(`=== En base: ${rows.length} prompts ===`);
for (const r of rows) {
  const flag = r.empty ? 'VIDE' : 'OK';
  console.log(`${flag} | ${r.prompt_key} | ${r.role} | ${r.len}c | ${r.name}`);
}

const missing = EXPECTED.filter((k) => !byKey.has(k));
const emptyExpected = EXPECTED.filter((k) => byKey.has(k) && byKey.get(k).empty);
const extra = rows.map((r) => r.prompt_key).filter((k) => !EXPECTED.includes(k));

console.log(`\n=== Attendu SettingsService: ${EXPECTED.length} ===`);
console.log('Manquants:', missing.length ? missing.join(', ') : '(aucun)');
console.log('Vides parmi attendus:', emptyExpected.length ? emptyExpected.join(', ') : '(aucun)');
console.log('Extra hors liste attendue:', extra.length ? extra.join(', ') : '(aucun)');

const allOk = missing.length === 0 && emptyExpected.length === 0;
console.log('\nVerdict:', allOk ? 'TOUS les prompts attendus sont renseignés.' : 'INCOMPLET');

await pool.end();
