-- Estimation de concurrence locale / sectorielle pour les idées business (2ᵉ passe IA).
-- Gemini : grounding Google Search ; autres providers : estimation documentée.

INSERT INTO ai_prompts (prompt_key, name, role, content) VALUES
(
  'business_competition',
  'Concurrence business — estimation (web si dispo)',
  'user',
  $prompt$Tu estimes la CONCURRENCE déjà en place (ou très probable) pour chaque idée de business ci-dessous.
Zone / marché de référence : {{ou}}
Budget utilisateur : {{budget}} {{currency}}

RÈGLES :
1) Pour chaque business, évalue la densité concurrentielle locale ou sectorielle (acteurs similaires, saturation, barrières).
2) Si la recherche web est disponible, utilise-la pour te baser sur des signaux réels (annuaires, acteurs connus, tendances locales). Sinon, estime clairement à partir de ton savoir.
3) competitionScore : entier 0–100
   - 0–24 : concurrence faible / niche ouverte
   - 25–49 : concurrence modérée
   - 50–74 : concurrence forte
   - 75–100 : marché saturé / très concurrentiel
4) competitionLabel : Faible | Modérée | Forte | Très forte (cohérent avec le score).
5) competitionNote : 1 phrase courte (max ~140 caractères) justifiant le score pour le porteur.
6) Reprends EXACTEMENT les titres fournis (même orthographe) — un item par business, pas plus, pas moins.
7) N'invente pas de noms d'entreprises absents de sources si tu n'as pas de web ; reste prudent.

Business à évaluer (JSON) :
{{businesses_json}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"items":[{"title":"titre exact","competitionScore":42,"competitionLabel":"Modérée","competitionNote":"phrase courte"}]}
$prompt$
)
ON CONFLICT (prompt_key) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role,
    content = EXCLUDED.content,
    updated_at = NOW();
