-- Prompt IA pour l'assistance formation (étape choix business).
-- Variables : {{business}} {{business_activity}} {{business_pitch}} {{business_rationale}}
--             {{quoi}} {{ou}} {{budget}} {{currency}} {{refine}} {{avoid}} {{count}}

INSERT INTO ai_prompts (prompt_key, name, role, content) VALUES
  (
    'formation',
    'Prompt Formation',
    'user',
    'Tu es un conseiller en formation professionnelle pour Kizumai.
Pour le business ci-dessous, propose EXACTEMENT {{count}} pistes de formation concrètes, réalistes et utiles pour réussir ce projet.

RÈGLES :
1) Chaque formation doit être clairement liée à CE business (compétences métier, réglementaire, gestion, commercial…).
2) Varie les angles (ex. métier + gestion + digital/commercial) quand c''est pertinent.
3) Reste pragmatique : durée, niveau et format réalistes pour un créateur d''entreprise.
4) Ne propose pas de formations génériques sans lien avec le business.
5) Formations déjà proposées à NE PAS répéter : {{avoid}}

Business : {{business}}
Secteur / activité : {{business_activity}}
Pitch : {{business_pitch}}
Pourquoi ce business : {{business_rationale}}
Idée de départ de l''utilisateur : {{quoi}}
Zone : {{ou}}
Budget disponible : {{budget}} {{currency}}
Précision pour affiner : {{refine}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"trainings":[{"title":"intitulé","level":"débutant|intermédiaire|avancé","duration":"durée estimée","format":"en_ligne|presentiel|mixte","rationale":"pourquoi c''est utile pour ce business","skills":["compétence1","compétence2"]}]}'
  )
ON CONFLICT (prompt_key) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role,
    content = EXCLUDED.content,
    updated_at = NOW();
