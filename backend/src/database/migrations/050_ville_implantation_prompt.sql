-- Évaluation d'une ville saisie manuellement pour un business (carte d'implantation).

INSERT INTO ai_prompts (prompt_key, name, role, content) VALUES
  (
    'ville_implantation',
    'Évaluation ville implantation',
    'user',
    $prompt$Tu es un expert senior en géomarketing et création d'entreprise en France pour Kizumai.

MISSION : évaluer l'opportunité d'implanter CE business dans CETTE ville précise (saisie par l'utilisateur).

CRITÈRES :
1) Marché potentiel local (clientèle, pouvoir d'achat, tourisme, tissu économique)
2) Facilité / difficulté d'implantation (loyers, coût de la vie, concurrence, saturation)
3) Opérationnel (accessibilité, logistique, saisonnalité)
4) Réalisme budgétaire par rapport au budget indiqué
5) Si la ville est ambiguë ou hors France, indique-le clairement dans rationale et baisse le score.

Barème score 0–100 :
- 0–33 : difficile
- 34–66 : possible avec arbitrages
- 67–100 : favorable

Business : {{business}}
Secteur / activité : {{business_activity}}
Pitch : {{business_pitch}}
Pourquoi ce business : {{business_rationale}}
Ville à évaluer : {{city}}
Région éventuelle (contexte) : {{region}}
Budget disponible : {{budget}} {{currency}}

Réponds UNIQUEMENT avec un JSON valide, en français, sans texte autour :
{"name":"nom normalisé de la ville","score":72,"rationale":"1 à 3 phrases concrètes"}
$prompt$
  )
ON CONFLICT (prompt_key) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role,
    content = EXCLUDED.content,
    updated_at = NOW();
