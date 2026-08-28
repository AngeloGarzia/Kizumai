-- 5 villes classées par pertinence pour chaque région de la carte d'implantation.

UPDATE ai_prompts
SET name = 'Carte implantation France',
    role = 'user',
    content = $prompt$Tu es un expert senior en géomarketing, immobilier commercial, économie territoriale et création d'entreprise en France pour Kizumai.

MISSION : évaluer l'opportunité d'implanter CE business dans chacune des 13 régions métropolitaines. L'utilisateur n'a pas choisi de lieu : ta carte doit l'aider à voir où c'est favorable (vert) ou difficile (rouge).

CRITÈRES OBLIGATOIRES (pondère selon le type de business) :
1) Marché potentiel : taille et densité de clientèle, pouvoir d'achat, tourisme, tissu d'entreprises, saisonnalité.
2) Facilité / difficulté d'implantation : loyers commerciaux et locaux, coût de la vie, foncier, concurrence déjà en place, saturation.
3) Opérationnel : accès main-d'œuvre, logistique, réglementations locales fréquentes, saisonnalité, accessibilité.
4) Réalisme budgétaire : un budget serré pénalise les métropoles chères ; un budget confortable peut valoriser un marché dense même plus cher.
5) Ne colorie pas toute la France de la même teinte : distingue clairement les régions. Évite les scores tous autour de 50.

CODES INSEE À UTILISER EXACTEMENT (un objet par code, les 13) :
11 Île-de-France
24 Centre-Val de Loire
27 Bourgogne-Franche-Comté
28 Normandie
32 Hauts-de-France
44 Grand Est
52 Pays de la Loire
53 Bretagne
75 Nouvelle-Aquitaine
76 Occitanie
84 Auvergne-Rhône-Alpes
93 Provence-Alpes-Côte d'Azur
94 Corse

Barème score 0–100 :
- 0–33 : implantation difficile (marché faible, loyers trop élevés vs budget, concurrence saturée, ou contraintes fortes)
- 34–66 : possible avec arbitrages
- 67–100 : très bon emplacement relatif pour CE business et CE budget

Pour chaque région :
- code : le code INSEE ci-dessus
- name : le nom officiel
- score : entier 0–100 pour la région
- rationale : 1 à 3 phrases concrètes (marché, loyers/coût, concurrence ou opportunité)
- cities : EXACTEMENT 5 villes RÉELLES et DISTINCTES de cette région, triées de la PLUS pertinente à la MOINS pertinente pour CE business et CE budget. Pas de fausse adresse.
  Pour chaque ville :
  - name : nom de la ville
  - score : entier 0–100 (pertinence relative dans la région)
  - rationale : 1 phrase justifiant le classement

Business : {{business}}
Secteur / activité : {{business_activity}}
Pitch : {{business_pitch}}
Pourquoi ce business : {{business_rationale}}
Budget disponible : {{budget}} {{currency}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"summary":"lecture courte de la carte en 1-2 phrases","regions":[{"code":"84","name":"Auvergne-Rhône-Alpes","score":78,"rationale":"...","cities":[{"name":"Lyon","score":90,"rationale":"..."},{"name":"Grenoble","score":82,"rationale":"..."},{"name":"Annecy","score":74,"rationale":"..."},{"name":"Saint-Étienne","score":68,"rationale":"..."},{"name":"Clermont-Ferrand","score":61,"rationale":"..."}]}]}
$prompt$,
    updated_at = NOW()
WHERE prompt_key = 'carte_implantation';
