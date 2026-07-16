-- Parcours de recherche en 3 phases piloté entièrement par les prompts en base.
-- Chaque prompt contient sa propre consigne + son contrat de sortie JSON.
-- Variables interpolées par le code (aucun prompt métier n'est en dur) :
--   {{quoi}} {{ou}} {{business}} {{location}} {{budget}} {{currency}}
--   {{budget_min}} {{budget_max}} {{refine}} {{avoid}} {{count}}

-- Phase 1 : recherche de 3 idées de business
UPDATE ai_prompts
SET role = 'user',
    content =
'Tu es un expert en création d''entreprise pour Kizumai.
À partir des informations ci-dessous, propose EXACTEMENT {{count}} idées de business distinctes, réalistes et directement exploitables.

Idée / envie de départ : {{quoi}}
Zone envisagée : {{ou}}
Budget disponible : {{budget}} {{currency}} (fourchette autorisée : {{budget_min}} à {{budget_max}} {{currency}})
Précision de l''utilisateur pour affiner la recherche : {{refine}}
Idées déjà proposées à NE PAS répéter : {{avoid}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"businesses":[{"title":"nom court du business","activity":"secteur/activité","pitch":"phrase d''accroche","rationale":"pourquoi c''est pertinent ici"}]}',
    updated_at = NOW()
WHERE prompt_key = 'project_user';

-- Phase 2 : recherche de 5 lieux d''implantation
UPDATE ai_prompts
SET role = 'user',
    content =
'Tu es un expert en implantation commerciale pour Kizumai.
Pour le business choisi, propose EXACTEMENT {{count}} lieux d''implantation pertinents et réalistes.

Business choisi : {{business}}
Zone / indication de départ : {{ou}}
Budget disponible : {{budget}} {{currency}}
Précision de l''utilisateur pour affiner : {{refine}}
Lieux déjà proposés à NE PAS répéter : {{avoid}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"locations":[{"label":"intitulé du lieu","city":"ville","area":"quartier ou zone","rationale":"pourquoi ce lieu est adapté"}]}',
    updated_at = NOW()
WHERE prompt_key = 'lieux';

-- Phase 3 : génération de 2 propositions de projet (budget utilisateur + budget idéal IA)
UPDATE ai_prompts
SET role = 'user',
    content =
'Tu es un expert en business plan pour Kizumai.
Pour le business et le lieu choisis, génère EXACTEMENT 2 propositions de projet complètes :
1) proposition "budget_utilisateur" : un projet calibré pour coller au budget indiqué par l''utilisateur ({{budget}} {{currency}}) ;
2) proposition "budget_ideal" : un projet avec le budget idéal que TU recommandes pour maximiser les chances de réussite (reste dans la fourchette {{budget_min}} à {{budget_max}} {{currency}}).

Business : {{business}}
Lieu : {{location}}
Précision de l''utilisateur pour affiner : {{refine}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"proposals":[{"kind":"budget_utilisateur","title":"titre du projet","budget":nombre,"currency":"{{currency}}","report":"synthèse courte","sections":[{"title":"section","content":"contenu"}]},{"kind":"budget_ideal","title":"titre du projet","budget":nombre,"currency":"{{currency}}","report":"synthèse courte","sections":[{"title":"section","content":"contenu"}]}]}',
    updated_at = NOW()
WHERE prompt_key = 'budget';
