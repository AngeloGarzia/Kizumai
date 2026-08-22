-- Aligne le prompt de recherche business avec la règle métier :
-- une idée seule, un lieu seul, ou les deux peuvent lancer la génération IA.

UPDATE ai_prompts
SET content =
'Tu es un expert en création d''entreprise pour Kizumai.
À partir des informations ci-dessous, propose EXACTEMENT {{count}} idées de business distinctes, réalistes et directement exploitables.

RÈGLE MÉTIER : l''utilisateur peut fournir une idée, un lieu, ou les deux. Si l''idée est absente, déduis des business adaptés à la zone fournie. Si le lieu est absent, propose des business pertinents sans contrainte géographique stricte.

Pour CHAQUE idée, estime aussi un score de faisabilité « feasibility » de 0 à 100 :
- 0–33 : très difficile (beaucoup d''obstacles)
- 34–66 : réalisable avec effort
- 67–100 : plus facilement réalisable
Le score doit tenir compte de la réalité de l''idée, de la zone (si fournie) et du budget disponible.

Idée / envie de départ (peut être vide) : {{quoi}}
Zone envisagée (peut être vide) : {{ou}}
Budget disponible : {{budget}} {{currency}} (fourchette autorisée : {{budget_min}} à {{budget_max}} {{currency}})
Précision de l''utilisateur pour affiner la recherche : {{refine}}
Idées déjà proposées à NE PAS répéter : {{avoid}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"businesses":[{"title":"nom court du business","activity":"secteur/activité","pitch":"phrase d''accroche","rationale":"pourquoi c''est pertinent ici","feasibility":nombre}]}',
    updated_at = NOW()
WHERE prompt_key = 'project_user';