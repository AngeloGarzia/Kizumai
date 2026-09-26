-- Rang de prédilection Fabulous + note faisabilité pour les propositions de lieux.

UPDATE ai_prompts
SET
  name = 'Prompt Lieux',
  role = 'user',
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
8) Chaque « rationale » doit donner à l'utilisateur une raison d'y croire, pas juste une raison logique. Formule comme un bénéfice concret pour lui, pas comme une justification pour toi-même.

Pour CHAQUE lieu, fournis :
- label : intitulé précis et exploitable ;
- city : ville ou zone principale ;
- area : quartier, axe, micro-zone ou type d'emplacement ;
- rationale : justification incluant clientèle cible, avantage du flux/localisation, cohérence avec le business, contrainte à vérifier et première action terrain ;
- feasibility : score de 0 à 100 selon adéquation business/lieu, coût probable, accès clientèle et complexité opérationnelle ;
- feasibilityNote : 2 phrases max (~280 car.) expliquant POURQUOI ce niveau d'adéquation pour CE lieu précis. INTERDIT de parler de barème, de segments, de « score /100 » ou de méthode de calcul ;
- fabulousRank : rang de PRÉDILECTION Fabulous, entier UNIQUE de 1 à {{count}} (1 = le meilleur choix global, {{count}} = le moins recommandé parmi cette liste). Classe selon adéquation réelle business/lieu, coût, flux clientèle et complexité. Le rang 1 doit vraiment cumuler le meilleur équilibre réaliste ;
- fabulousPickNote : 1 phrase (~160 car.) justifiant ce rang (surtout pour 1–3).

Barème feasibility : 0–33 difficile ; 34–66 possible avec effort ; 67–100 réaliste.
Les fabulousRank doivent être cohérents avec feasibility (pas de rang 1 avec un lieu peu adapté sauf angle exceptionnel justifié dans fabulousPickNote).

Business choisi : {{business}}
Secteur / activité : {{business_activity}}
Pitch du business : {{business_pitch}}
Pourquoi ce business : {{business_rationale}}
Zone / indication de départ saisie par l'utilisateur : {{ou}}
Budget disponible : {{budget}} {{currency}}
Précision pour affiner : {{refine}}
Lieux déjà proposés à NE PAS répéter : {{avoid}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"locations":[{"label":"intitulé du lieu","city":"ville","area":"quartier ou zone","rationale":"lien explicite avec le business et, le cas échéant, avec la zone saisie","feasibility":nombre,"feasibilityNote":"explication métier","fabulousRank":1,"fabulousPickNote":"pourquoi ce rang"}]}
$prompt$,
  updated_at = NOW()
WHERE prompt_key = 'lieux';
