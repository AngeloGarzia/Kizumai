-- Phase 2 : les lieux proposés doivent être corrélés au business choisi
-- et, si fournie, à la zone saisie par l'utilisateur.
-- Variables : {{business}} {{business_activity}} {{business_pitch}} {{business_rationale}}
--             {{ou}} {{budget}} {{currency}} {{refine}} {{avoid}} {{count}}

UPDATE ai_prompts
SET role = 'user',
    content =
'Tu es un expert en implantation commerciale pour Kizumai.
Ta mission : proposer EXACTEMENT {{count}} lieux d''implantation en PARFAITE adéquation avec le business choisi.

RÈGLES IMPÉRATIVES :
1) Chaque lieu DOIT être pensé pour CE business précis (clientèle, flux, accessibilité, concurrence, typologie de local, logistique).
2) Si une zone / indication de départ est fournie ci-dessous (champ non vide et différent de « non précisée »), TOUS les lieux proposés DOIVENT se situer DANS ou À PROXIMITÉ IMMÉDIATE de cette zone. Affine ensuite en quartiers, artères, zones commerciales ou adresses stratégiques cohérents avec cette zone ET avec le business.
3) Si aucune zone n''est précisée, propose des emplacements stratégiques réalistes, toujours justifiés par le business choisi.
4) Les {{count}} propositions doivent être distinctes (pas de doublons) et concrètes (ville + quartier/zone + intitulé).
5) Interdiction de proposer un lieu générique sans lien clair avec le business.

Business choisi : {{business}}
Secteur / activité : {{business_activity}}
Pitch du business : {{business_pitch}}
Pourquoi ce business : {{business_rationale}}
Zone / indication de départ saisie par l''utilisateur : {{ou}}
Budget disponible : {{budget}} {{currency}}
Précision pour affiner : {{refine}}
Lieux déjà proposés à NE PAS répéter : {{avoid}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"locations":[{"label":"intitulé du lieu","city":"ville","area":"quartier ou zone","rationale":"lien explicite avec le business et, le cas échéant, avec la zone saisie"}]}',
    updated_at = NOW()
WHERE prompt_key = 'lieux';
