-- Phase 3 : 3 propositions (budget utilisateur / flexible / idéal IA)
-- + alerte si le budget de départ semble vraiment trop élevé.
-- Variables : {{business}} {{location}} {{budget}} {{currency}}
--             {{budget_min}} {{budget_max}} {{refine}}

UPDATE ai_prompts
SET role = 'user',
    content =
'Tu es un expert en business plan pour Kizumai.
Pour le business et le lieu choisis, génère EXACTEMENT 3 propositions de projet complètes, distinctes et réalistes :

1) "budget_utilisateur" : projet calibré pour coller au budget indiqué par l''utilisateur ({{budget}} {{currency}}).
2) "budget_flexible" : projet INTERMÉDIAIRE, entre le budget utilisateur et le budget idéal — un compromis réaliste (ni trop serré, ni maximaliste).
3) "budget_ideal" : projet avec le budget idéal que TU recommandes pour maximiser les chances de réussite (reste dans la fourchette {{budget_min}} à {{budget_max}} {{currency}}).

ÉVALUE AUSSI le budget de départ de l''utilisateur :
- Si ce budget semble VRAIMENT trop élevé / disproportionné par rapport au business et au lieu (surinvestissement évident, gaspillage de capital, risque de sur-dimensionnement), alors budget_assessment.user_budget_too_high = true et explique clairement pourquoi dans message (en français, 1 à 3 phrases).
- Sinon, user_budget_too_high = false et message peut être une chaîne vide.

Ordre des budgets attendu en général : budget_utilisateur ≤ budget_flexible ≤ budget_ideal (sauf si le budget utilisateur est déjà trop haut : dans ce cas, budget_flexible et budget_ideal peuvent être INFÉRIEURS au budget utilisateur pour le ramener à un niveau raisonnable).

Business : {{business}}
Lieu : {{location}}
Budget de départ utilisateur : {{budget}} {{currency}}
Précision pour affiner : {{refine}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"budget_assessment":{"user_budget_too_high":false,"message":""},"proposals":[{"kind":"budget_utilisateur","title":"titre","budget":nombre,"currency":"{{currency}}","report":"synthèse courte","sections":[{"title":"section","content":"contenu"}]},{"kind":"budget_flexible","title":"titre","budget":nombre,"currency":"{{currency}}","report":"synthèse courte","sections":[{"title":"section","content":"contenu"}]},{"kind":"budget_ideal","title":"titre","budget":nombre,"currency":"{{currency}}","report":"synthèse courte","sections":[{"title":"section","content":"contenu"}]}]}',
    updated_at = NOW()
WHERE prompt_key = 'budget';
