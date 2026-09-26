-- Rang de prédilection Fabulous (installation + rentabilité + concurrence).

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
- feasibility : score de LANCEMENT / réussite opérationnelle du concept, 0–100 (propre à CETTE idée). Doit intégrer la rentabilité future RÉELLE et SÉRIEUSE plausible — pas seulement « assez d'argent pour démarrer ». Un budget trop élevé pour le besoin du concept NE DOIT PAS gonfler feasibility (surinvestissement ≠ succès) ;
- competitionScore : densité concurrentielle locale/sectorielle, 0–100 (propre à CETTE idée — NE PAS donner le même score à toutes) ;
  - 0–24 Faible / niche ouverte ; 25–49 Modérée ; 50–74 Forte ; 75–100 Très forte / saturée ;
- competitionLabel : Faible | Modérée | Forte | Très forte (cohérent avec competitionScore) ;
- competitionNote : 1 phrase courte (~140 car.) justifiant le score de concurrence pour ce concept précis ;
- profitabilityScore : rentabilité future probable, RÉELLE et SÉRIEUSE (retour / marge / capacité à générer des bénéfices crédibles), 0–100 (propre à CETTE idée — variez) ;
  - 0–24 Fragile ; 25–49 Limitée ; 50–74 Plausible ; 75–100 Solide ;
  - Un budget trop élevé pour le modèle (coûts fixes / CAPEX hors besoin) DOIT abaisser ou plafonner profitabilityScore : l'argent en trop n'améliore pas le ROI ;
- profitabilityLabel : Fragile | Limitée | Plausible | Solide (cohérent avec profitabilityScore) ;
- profitabilityNote : 1 phrase courte (~140 car.) justifiant la rentabilité sérieuse (ou sa faiblesse) ;
- fabulousRank : rang de PRÉDILECTION Fabulous, entier UNIQUE de 1 à {{count}} (1 = le meilleur choix global, {{count}} = le moins recommandé parmi cette liste). Classe selon des conditions RÉELLES et SÉRIEUSES : facilité d'installation (feasibility), rendement crédible (profitabilityScore), et pression concurrentielle (un competitionScore BAS est favorable). N'invente pas un favori « marketing » : le rang 1 doit vraiment cumuler le meilleur équilibre réaliste ;
- fabulousPickNote : 1 phrase courte (~140 car.) expliquant POURQUOI ce rang (surtout utile pour le rang 1) ;
- modes : tableau de 1 à 3 objets {type,label,angle,feasibility}.

Barème feasibility : 0–33 difficile ; 34–66 possible avec effort ; 67–100 réaliste.
IMPORTANT : feasibility, competitionScore et profitabilityScore mesurent des choses DIFFÉRENTES.
- Feasibility = lançabilité / chance de mettre le projet sur pied.
- CompetitionScore = pression concurrentielle (haut = saturé).
- ProfitabilityScore = rentabilité future crédible (haut = solide).
Une idée facile à lancer peut être peu rentable (feasibility haut, profitabilityScore bas). Un gros budget sans modèle économique solide ne donne PAS des scores hauts. Varie les trois scores d'une idée à l'autre.
Les fabulousRank doivent être cohérents avec ces trois scores (pas de rang 1 avec rentabilité fragile et concurrence saturée sauf angle exceptionnel justifié dans fabulousPickNote).

Idée / envie de départ (peut être vide) : {{quoi}}
Zone envisagée (peut être vide) : {{ou}}
Budget disponible : {{budget}} {{currency}} (fourchette : {{budget_min}} à {{budget_max}} {{currency}})
Précision pour affiner : {{refine}}
Idées déjà proposées à NE PAS répéter : {{avoid}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"businesses":[{"title":"nom court","activity":"secteur","pitch":"accroche","rationale":"pourquoi","feasibility":nombre,"competitionScore":nombre,"competitionLabel":"Modérée","competitionNote":"phrase courte","profitabilityScore":nombre,"profitabilityLabel":"Plausible","profitabilityNote":"phrase courte","fabulousRank":1,"fabulousPickNote":"pourquoi ce rang","modes":[{"type":"fixed|nomadic|dematerialized","label":"libellé court","angle":"angle du mode","feasibility":nombre}]}]}
$prompt$,
  updated_at = NOW()
WHERE prompt_key = 'project_user';
