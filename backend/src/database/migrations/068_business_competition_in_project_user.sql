-- Concurrence estimée dans la même passe IA que la faisabilité business (project_user).

UPDATE ai_prompts
SET
  name = 'Prompt projet',
  role = 'user',
  content = $prompt$Tu es un expert senior en création d'entreprise, étude de marché locale et stratégie de lancement pour Kizumai.
Ta mission : proposer EXACTEMENT {{count}} idées de business DISTINCTES (concepts métier), concrètes, pertinentes et exploitables.

RÈGLE MÉTIER — ANCRAGE / MOBILITÉ (CRITIQUE) :
- Chaque idée est UN concept. Elle peut proposer 1 à 3 modes d'ancrage dans le tableau "modes", mais cela compte toujours pour 1 seule idée dans les {{count}}.
- Modes autorisés : "fixed" (lieu physique ancré), "nomadic" (activité mobile / itinérante), "dematerialized" (digital / sans point de vente physique, marché régional à mondial).
- Cohérence absolue : ne propose un mode QUE s'il est crédible pour CE concept. Interdit de coller les 3 modes partout.
  Ex. salon de coiffure → surtout fixed ; food-truck / caravane marchés → surtout nomadic (+ fixed atelier éventuellement) ; SaaS / app → surtout dematerialized (+ fixed siège légal éventuellement).
- Varie les concepts : mélange ancrés, nomades et dématérialisés parmi les {{count}} idées quand le budget et le contexte le permettent.
- Pour chaque mode fourni : type, label court, angle (1 phrase), feasibility 0–100 propre à ce mode.

RÈGLE MÉTIER : l'utilisateur peut fournir une idée, un lieu, ou les deux.
- Si l'idée est absente, déduis des opportunités à partir du lieu.
- Si le lieu est absent, propose des concepts robustes sans inventer une ville précise.
- Si idée et lieu sont fournis, relie explicitement l'idée au contexte local (surtout pour fixed / nomadic).

EXIGENCE QUALITÉ :
1) Évite les idées standard ou vagues sauf angle très ciblé et justifié.
2) Chaque idée résout un problème réel ou capte une opportunité claire.
3) Varie les modèles économiques : service local, commerce, B2B, mobile/itinérant, abonnement, digital, économie circulaire.
4) Reste réaliste avec le budget.
5) Ne répète jamais les idées déjà proposées (compare sur le title / concept, pas sur chaque mode).
6) Favorise les idées lançables par un porteur seul ou une petite équipe.
7) Chaque « rationale » doit donner à l'utilisateur une raison d'y croire, pas juste une raison logique. Formule comme un bénéfice concret pour lui, pas comme une justification pour toi-même.

Pour CHAQUE idée :
- title, activity, pitch, rationale ;
- feasibility : score global de réussite du concept, 0–100 (propre à CETTE idée — variez nettement les scores selon complexité, budget, marché) ;
- competitionScore : densité concurrentielle locale/sectorielle, 0–100 (propre à CETTE idée — NE PAS donner le même score à toutes) ;
  - 0–24 Faible / niche ouverte ; 25–49 Modérée ; 50–74 Forte ; 75–100 Très forte / saturée ;
- competitionLabel : Faible | Modérée | Forte | Très forte (cohérent avec competitionScore) ;
- competitionNote : 1 phrase courte (~140 car.) justifiant le score de concurrence pour ce concept précis ;
- modes : tableau de 1 à 3 objets {type,label,angle,feasibility}.

Barème feasibility : 0–33 difficile ; 34–66 possible avec effort ; 67–100 réaliste.
IMPORTANT : feasibility et competitionScore mesurent des choses DIFFÉRENTES. Une idée facile à lancer peut être dans un marché très concurrentiel (feasibility haut, competitionScore haut), et inversement. Varie les deux scores d'une idée à l'autre.

Idée / envie de départ (peut être vide) : {{quoi}}
Zone envisagée (peut être vide) : {{ou}}
Budget disponible : {{budget}} {{currency}} (fourchette : {{budget_min}} à {{budget_max}} {{currency}})
Précision pour affiner : {{refine}}
Idées déjà proposées à NE PAS répéter : {{avoid}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"businesses":[{"title":"nom court","activity":"secteur","pitch":"accroche","rationale":"pourquoi","feasibility":nombre,"competitionScore":nombre,"competitionLabel":"Modérée","competitionNote":"phrase courte","modes":[{"type":"fixed|nomadic|dematerialized","label":"libellé court","angle":"angle du mode","feasibility":nombre}]}]}
$prompt$,
  updated_at = NOW()
WHERE prompt_key = 'project_user';
