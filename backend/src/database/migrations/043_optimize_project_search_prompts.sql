-- Renforce fortement les prompts IA du parcours "Créer son avenir".
-- Objectif : obtenir des réponses moins génériques, plus locales, différenciantes,
-- actionnables et cohérentes avec les contrats JSON déjà consommés par l'API.

UPDATE ai_prompts
SET role = 'user',
    content = $prompt$Tu es un expert senior en création d'entreprise, étude de marché locale et stratégie de lancement pour Kizumai.
Ta mission : proposer EXACTEMENT {{count}} idées de business distinctes, concrètes, pertinentes et exploitables à partir des informations fournies.

RÈGLE MÉTIER : l'utilisateur peut fournir une idée, un lieu, ou les deux.
- Si l'idée est absente, déduis des opportunités à partir du lieu : besoins locaux probables, flux, typologie de clientèle, pouvoir d'achat, tourisme, entreprises, habitudes de consommation, contraintes terrain.
- Si le lieu est absent, propose des concepts robustes et adaptables, sans inventer une ville précise.
- Si idée et lieu sont fournis, chaque proposition doit relier explicitement l'idée au contexte local.

EXIGENCE QUALITÉ — À RESPECTER ABSOLUMENT :
1) Évite les idées standard ou vagues (restaurant, café, boutique, agence, application générique) sauf si tu les transformes avec un angle très ciblé, différenciant et justifié.
2) Chaque idée doit résoudre un problème réel ou capter une opportunité claire : manque d'offre, clientèle mal servie, tendance locale, saisonnalité, niche, contrainte devenue opportunité.
3) Varie les modèles économiques : service local, commerce spécialisé, B2B, mobile/itinérant, abonnement, atelier/formation, économie circulaire, digital avec ancrage local.
4) Reste réaliste avec le budget : pas de projet surdimensionné, pas de dépendance à une technologie lourde ou à une équipe importante si le budget est limité.
5) Ne répète jamais les idées déjà proposées ; si la liste est longue, éloigne-toi clairement de leurs secteurs et angles.
6) Favorise les idées lançables par un porteur seul ou une petite équipe, avec un premier test marché rapide.

Pour CHAQUE idée, fournis :
- title : nom court, spécifique, non générique ;
- activity : secteur précis ;
- pitch : proposition de valeur claire en une phrase ;
- rationale : justification concrète incluant clientèle cible, besoin/opportunité, différenciation, premier canal d'acquisition et principal risque ;
- feasibility : score de 0 à 100 tenant compte du budget, du niveau de complexité, du lieu si fourni, de la concurrence probable et de la facilité de lancement.

Barème feasibility :
- 0–33 : très difficile, obstacles importants ou budget insuffisant ;
- 34–66 : possible mais demande validation, effort ou arbitrages ;
- 67–100 : lancement réaliste avec budget et contexte cohérents.

Idée / envie de départ (peut être vide) : {{quoi}}
Zone envisagée (peut être vide) : {{ou}}
Budget disponible : {{budget}} {{currency}} (fourchette autorisée : {{budget_min}} à {{budget_max}} {{currency}})
Précision de l'utilisateur pour affiner la recherche : {{refine}}
Idées déjà proposées à NE PAS répéter : {{avoid}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"businesses":[{"title":"nom court du business","activity":"secteur/activité","pitch":"phrase d'accroche","rationale":"pourquoi c'est pertinent ici","feasibility":nombre}]}$prompt$,
    updated_at = NOW()
WHERE prompt_key = 'project_user';

UPDATE ai_prompts
SET role = 'user',
    content = $prompt$Tu es un expert senior en implantation commerciale, géomarketing et développement local pour Kizumai.
Ta mission : proposer EXACTEMENT {{count}} lieux d'implantation en forte adéquation avec le business choisi, le budget et la zone indiquée.

RÈGLES IMPÉRATIVES :
1) Chaque lieu doit être pensé pour CE business précis : clientèle, flux, accessibilité, visibilité, logistique, concurrence, contraintes de local, saisonnalité et budget.
2) Si une zone est fournie et différente de « non précisée », tous les lieux doivent rester dans cette zone ou à proximité immédiate. Affine en ville, quartier, axe, zone commerciale, marché, gare, campus, zone d'activité ou emplacement stratégique réaliste.
3) Si aucune zone n'est précisée, propose des types d'emplacements concrets et cohérents sans inventer de fausses adresses.
4) Les propositions doivent être distinctes : pas deux variantes du même quartier ou du même type d'emplacement.
5) Interdiction de proposer un lieu générique sans expliquer pourquoi il augmente les chances de réussite du business.
6) Tiens compte du budget : si le budget est limité, privilégie emplacement partagé, pop-up, marché, atelier mutualisé, périphérie active, livraison ou modèle mobile plutôt qu'un local premium.
7) Ne répète pas les lieux déjà proposés.

Pour CHAQUE lieu, fournis :
- label : intitulé précis et exploitable ;
- city : ville ou zone principale ;
- area : quartier, axe, micro-zone ou type d'emplacement ;
- rationale : justification incluant clientèle cible, avantage du flux/localisation, cohérence avec le business, contrainte à vérifier et première action terrain ;
- feasibility : score de 0 à 100 selon adéquation business/lieu, coût probable, accès clientèle et complexité opérationnelle.

Business choisi : {{business}}
Secteur / activité : {{business_activity}}
Pitch du business : {{business_pitch}}
Pourquoi ce business : {{business_rationale}}
Zone / indication de départ saisie par l'utilisateur : {{ou}}
Budget disponible : {{budget}} {{currency}}
Précision pour affiner : {{refine}}
Lieux déjà proposés à NE PAS répéter : {{avoid}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"locations":[{"label":"intitulé du lieu","city":"ville","area":"quartier ou zone","rationale":"lien explicite avec le business et, le cas échéant, avec la zone saisie","feasibility":nombre}]}$prompt$,
    updated_at = NOW()
WHERE prompt_key = 'lieux';

UPDATE ai_prompts
SET role = 'user',
    content = $prompt$Tu es un expert senior en business plan, lancement terrain, finance de démarrage et stratégie opérationnelle pour Kizumai.
Pour le business et le lieu choisis, génère EXACTEMENT 3 propositions de projet complètes, distinctes, réalistes et actionnables.

PROPOSITIONS ATTENDUES :
1) "budget_utilisateur" : projet calibré pour coller au budget indiqué par l'utilisateur ({{budget}} {{currency}}), avec arbitrages clairs si le budget est serré.
2) "budget_flexible" : compromis réaliste entre budget utilisateur et budget idéal, améliorant les chances de réussite sans surdimensionner.
3) "budget_ideal" : budget recommandé pour maximiser les chances de réussite, dans la fourchette {{budget_min}} à {{budget_max}} {{currency}}.

PROPOSITION OPTIONNELLE « budget_ajuste » :
- Ajoute UNE proposition supplémentaire de kind "budget_ajuste" SI ET SEULEMENT SI un projet viable est possible avec un budget STRICTEMENT INFÉRIEUR à {{budget}} {{currency}}.
- Le montant doit être inférieur au budget utilisateur, crédible, et le report doit expliquer pourquoi ce budget plus bas suffit.
- Sinon, n'ajoute pas cette proposition.

EXIGENCE QUALITÉ :
1) Chaque proposition doit être concrète : offre, cible, positionnement, premiers coûts, acquisition clients, opérations, jalons et risques.
2) Les sections ne doivent pas être de simples généralités : donne des actions terrain, hypothèses réalistes et décisions utiles.
3) Le budget doit être cohérent avec le lieu, le type de local, le stock, l'équipement, le marketing, les démarches, la trésorerie de départ et une marge d'imprévu.
4) Si le budget utilisateur est trop bas, explique les concessions sans inventer une viabilité artificielle.
5) Si le budget utilisateur est trop élevé, signale le risque de surinvestissement et propose une allocation plus prudente.
6) Évite les promesses : parle en hypothèses à valider et en prochaines actions.

ÉVALUE AUSSI le budget de départ :
- Si le budget semble vraiment trop élevé ou disproportionné, budget_assessment.user_budget_too_high = true et message explique pourquoi en 1 à 3 phrases.
- Sinon, user_budget_too_high = false et message peut être vide.
- budget_assessment.feasibility = score global du parcours de 0 à 100.
- budget_assessment.adjusted_proposed = true si une proposition "budget_ajuste" est incluse, sinon false.

Pour CHAQUE proposition :
- kind : respecte exactement les valeurs attendues ;
- title : titre précis ;
- budget : nombre réaliste ;
- currency : {{currency}} ;
- feasibility : score de 0 à 100 ;
- report : synthèse claire avec positionnement, cible, budget et logique de lancement ;
- sections : 5 à 7 sections utiles parmi offre, client cible, différenciation, plan de lancement 30 jours, budget détaillé, acquisition, opérations, risques, prochaines validations.

Ordre des budgets attendu en général : budget_utilisateur ≤ budget_flexible ≤ budget_ideal, sauf si le budget utilisateur est déjà trop haut ; dans ce cas budget_flexible et budget_ideal peuvent être inférieurs.

Business : {{business}}
Lieu : {{location}}
Budget de départ utilisateur : {{budget}} {{currency}}
Précision pour affiner : {{refine}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"budget_assessment":{"user_budget_too_high":false,"message":"","feasibility":nombre,"adjusted_proposed":false},"proposals":[{"kind":"budget_utilisateur","title":"titre","budget":nombre,"currency":"{{currency}}","feasibility":nombre,"report":"synthèse courte","sections":[{"title":"section","content":"contenu"}]},{"kind":"budget_flexible","title":"titre","budget":nombre,"currency":"{{currency}}","feasibility":nombre,"report":"synthèse courte","sections":[{"title":"section","content":"contenu"}]},{"kind":"budget_ideal","title":"titre","budget":nombre,"currency":"{{currency}}","feasibility":nombre,"report":"synthèse courte","sections":[{"title":"section","content":"contenu"}]}]}$prompt$,
    updated_at = NOW()
WHERE prompt_key = 'budget';

UPDATE ai_prompts
SET name = 'Prompt Formation',
    role = 'user',
    content = $prompt$Tu es un conseiller senior en formation professionnelle, montée en compétences entrepreneuriales et conformité métier pour Kizumai.
Pour le business ci-dessous, propose EXACTEMENT {{count}} pistes de formation concrètes, utiles et directement reliées à la réussite du projet.

EXIGENCE QUALITÉ :
1) Chaque formation doit répondre à un besoin précis du porteur : compétence métier, réglementation, vente, gestion, digital, production, hygiène/sécurité, relation client, finance ou management.
2) Varie les angles : ne propose pas trois formations génériques en entrepreneuriat.
3) Priorise ce qui réduit les risques majeurs du projet et accélère les premières ventes.
4) Adapte le niveau au contexte : débutant si le porteur doit démarrer, intermédiaire/avancé seulement si cela apporte un avantage clair.
5) Propose des formats réalistes pour un créateur d'entreprise : court, certifiant si nécessaire, en ligne, présentiel local ou mixte.
6) Si le lieu est fourni, privilégie les formations compatibles avec le territoire ou les contraintes locales ; sinon reste adaptable.
7) Ne répète pas les formations déjà proposées et évite les intitulés vagues.

Pour CHAQUE formation, fournis :
- title : intitulé précis ;
- level : débutant, intermédiaire ou avancé ;
- duration : durée estimée réaliste ;
- format : en_ligne, presentiel ou mixte ;
- rationale : pourquoi cette formation améliore concrètement les chances du projet, quel risque elle réduit et quand la suivre ;
- skills : 2 à 5 compétences concrètes.

Business : {{business}}
Secteur / activité : {{business_activity}}
Pitch : {{business_pitch}}
Pourquoi ce business : {{business_rationale}}
Idée de départ de l'utilisateur : {{quoi}}
Zone : {{ou}}
Budget disponible : {{budget}} {{currency}}
Précision pour affiner : {{refine}}
Formations déjà proposées à NE PAS répéter : {{avoid}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"trainings":[{"title":"intitulé","level":"débutant|intermédiaire|avancé","duration":"durée estimée","format":"en_ligne|presentiel|mixte","rationale":"pourquoi c'est utile pour ce business","skills":["compétence1","compétence2"]}]}$prompt$,
    updated_at = NOW()
WHERE prompt_key = 'formation';