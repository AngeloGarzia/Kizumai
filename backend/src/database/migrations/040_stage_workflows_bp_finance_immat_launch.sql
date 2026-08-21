-- Seed workflows + jalons pour BP, financement, immatriculation, lancement

-- ── Business plan ────────────────────────────────────────────────
INSERT INTO stage_workflow_templates (stage, slug, title, description, sort_order, is_required)
VALUES
  ('business_plan', 'modele', 'Modèle économique', 'Proposition de valeur, clients et canaux.', 1, TRUE),
  ('business_plan', 'offre', 'Offre & pricing', 'Produits / services et grille tarifaire.', 2, TRUE),
  ('business_plan', 'previsionnel', 'Prévisionnel', 'Chiffre d''affaires, charges et trésorerie.', 3, TRUE),
  ('business_plan', 'organisation', 'Organisation', 'Équipe, partenaires et moyens.', 4, TRUE),
  ('business_plan', 'livrable', 'Livrable BP', 'Document business plan consolidé.', 5, TRUE)
ON CONFLICT (stage, slug) DO NOTHING;

INSERT INTO stage_workflow_actions (template_id, slug, title, description, sort_order, is_required, default_duration_days)
SELECT t.id, a.slug, a.title, a.description, a.sort_order, a.is_required, a.default_duration_days
FROM stage_workflow_templates t
JOIN (
  VALUES
    ('modele', 'valeur', 'Formaliser la proposition de valeur', 'Ce que vous apportez au client.', 1, TRUE, 5),
    ('modele', 'segments', 'Décrire les segments clients', 'Cibles prioritaires du BP.', 2, TRUE, 3),
    ('modele', 'canaux', 'Choisir les canaux d''acquisition', 'Comment atteindre les clients.', 3, TRUE, 4),
    ('offre', 'catalogue', 'Décrire l''offre (produits / services)', 'Périmètre commercial.', 1, TRUE, 5),
    ('offre', 'prix', 'Fixer la grille tarifaire', 'Prix, packs, remises.', 2, TRUE, 5),
    ('previsionnel', 'ca', 'Estimer le CA prévisionnel (12–36 mois)', 'Scénario réaliste.', 1, TRUE, 7),
    ('previsionnel', 'charges', 'Lister les charges principales', 'Fixes et variables.', 2, TRUE, 5),
    ('previsionnel', 'tresorerie', 'Ébaucher le plan de trésorerie', 'Besoin en fonds de roulement.', 3, TRUE, 7),
    ('organisation', 'equipe', 'Définir l''équipe et les rôles', 'Qui fait quoi.', 1, TRUE, 3),
    ('organisation', 'moyens', 'Identifier locaux / outils / fournisseurs', 'Moyens nécessaires.', 2, TRUE, 4),
    ('livrable', 'rediger', 'Rédiger le business plan', 'Document synthétique.', 1, TRUE, 10),
    ('livrable', 'relire', 'Faire relire le BP', 'Feedback conseiller / pair.', 2, FALSE, 5)
) AS a(template_slug, slug, title, description, sort_order, is_required, default_duration_days)
  ON t.slug = a.template_slug AND t.stage = 'business_plan'
ON CONFLICT (template_id, slug) DO NOTHING;

INSERT INTO stage_milestone_templates (stage, slug, title, description, offset_days, sort_order)
VALUES
  ('business_plan', 'kickoff', 'Démarrage BP', 'Lancement de la rédaction du business plan.', 0, 1),
  ('business_plan', 'draft-modele', 'Brouillon modèle économique', 'Canvas / modèle validé en brouillon.', 14, 2),
  ('business_plan', 'previsionnel', 'Prévisionnel prêt', 'Chiffres consolidés.', 28, 3),
  ('business_plan', 'bp-v1', 'Business plan v1', 'Première version complète.', 35, 4),
  ('business_plan', 'validation', 'Validation BP', 'BP prêt pour financement.', 42, 5)
ON CONFLICT (stage, slug) DO NOTHING;

-- ── Financement ──────────────────────────────────────────────────
INSERT INTO stage_workflow_templates (stage, slug, title, description, sort_order, is_required)
VALUES
  ('financement', 'besoin', 'Besoin de financement', 'Montant, usages et calendrier.', 1, TRUE),
  ('financement', 'sources', 'Sources', 'Apports, prêts, aides, investisseurs.', 2, TRUE),
  ('financement', 'dossier', 'Dossier', 'Pièces et argumentaire financeur.', 3, TRUE),
  ('financement', 'negociations', 'Négociations', 'Rendez-vous et conditions.', 4, TRUE),
  ('financement', 'decision', 'Décision', 'Accord et déblocage des fonds.', 5, TRUE)
ON CONFLICT (stage, slug) DO NOTHING;

INSERT INTO stage_workflow_actions (template_id, slug, title, description, sort_order, is_required, default_duration_days)
SELECT t.id, a.slug, a.title, a.description, a.sort_order, a.is_required, a.default_duration_days
FROM stage_workflow_templates t
JOIN (
  VALUES
    ('besoin', 'montant', 'Chiffrer le besoin total', 'Investissement + BFR.', 1, TRUE, 5),
    ('besoin', 'usages', 'Détailler l''emploi des fonds', 'Poste par poste.', 2, TRUE, 4),
    ('sources', 'apport', 'Définir l''apport personnel', 'Part auto-financée.', 1, TRUE, 3),
    ('sources', 'aides', 'Recenser les aides éligibles', 'Subventions, exonérations.', 2, TRUE, 7),
    ('sources', 'prets', 'Identifier les prêts possibles', 'Banque, BPI, microcrédit…', 3, TRUE, 5),
    ('dossier', 'pieces', 'Constituer le dossier financeur', 'BP, prévisionnel, pièces ID.', 1, TRUE, 10),
    ('dossier', 'pitch', 'Préparer le pitch financeur', 'Story + chiffres clés.', 2, TRUE, 5),
    ('negociations', 'rdv', 'Prendre au moins 2 RDV financeurs', 'Banque / organisme.', 1, TRUE, 14),
    ('negociations', 'comparer', 'Comparer les offres', 'Taux, garanties, délais.', 2, TRUE, 7),
    ('decision', 'choix', 'Choisir le montage retenu', 'Décision motivée.', 1, TRUE, 3),
    ('decision', 'signature', 'Signer / formaliser l''accord', 'Lettre, contrat, déblocage.', 2, TRUE, 14)
) AS a(template_slug, slug, title, description, sort_order, is_required, default_duration_days)
  ON t.slug = a.template_slug AND t.stage = 'financement'
ON CONFLICT (template_id, slug) DO NOTHING;

INSERT INTO stage_milestone_templates (stage, slug, title, description, offset_days, sort_order)
VALUES
  ('financement', 'kickoff', 'Cadrage besoin', 'Besoin chiffré.', 0, 1),
  ('financement', 'dossier-pret', 'Dossier prêt', 'Dossier envoyable.', 21, 2),
  ('financement', 'rdv-banque', 'Premiers RDV', 'Contacts financeurs démarrés.', 28, 3),
  ('financement', 'offre', 'Offre reçue', 'Au moins une proposition.', 42, 4),
  ('financement', 'accord', 'Financement accordé', 'Montage validé.', 56, 5)
ON CONFLICT (stage, slug) DO NOTHING;

-- ── Immatriculation ─────────────────────────────────────────────
INSERT INTO stage_workflow_templates (stage, slug, title, description, sort_order, is_required)
VALUES
  ('immatriculation', 'forme', 'Forme juridique', 'Choix et paramètres de la structure.', 1, TRUE),
  ('immatriculation', 'pieces', 'Pièces administratives', 'Documents requis pour le dépôt.', 2, TRUE),
  ('immatriculation', 'depot', 'Dépôt & formalités', 'Guichet unique / greffe.', 3, TRUE),
  ('immatriculation', 'fiscal', 'Fiscal & social', 'Régimes et affiliations.', 4, TRUE),
  ('immatriculation', 'ouverture', 'Ouverture opérationnelle', 'Compte, assurances, outils.', 5, TRUE)
ON CONFLICT (stage, slug) DO NOTHING;

INSERT INTO stage_workflow_actions (template_id, slug, title, description, sort_order, is_required, default_duration_days)
SELECT t.id, a.slug, a.title, a.description, a.sort_order, a.is_required, a.default_duration_days
FROM stage_workflow_templates t
JOIN (
  VALUES
    ('forme', 'choisir', 'Choisir la forme juridique', 'EI, EURL, SASU…', 1, TRUE, 7),
    ('forme', 'statuts', 'Préparer les statuts / déclaration', 'Avec modèle ou professionnel.', 2, TRUE, 7),
    ('pieces', 'identite', 'Rassembler les pièces d''identité', 'Dirigeant(s).', 1, TRUE, 3),
    ('pieces', 'domicile', 'Justifier le siège / domicile', 'Bail, attestation…', 2, TRUE, 5),
    ('depot', 'inpi', 'Déposer le dossier (guichet unique)', 'Formalités INPI / greffe.', 1, TRUE, 10),
    ('depot', 'kbis', 'Obtenir le Kbis / avis de situation', 'Preuve d''immatriculation.', 2, TRUE, 14),
    ('fiscal', 'regime', 'Choisir régime fiscal / TVA', 'Avec expert-comptable si besoin.', 1, TRUE, 5),
    ('fiscal', 'urssaf', 'Affilier social / URSSAF', 'Couverture et cotisations.', 2, TRUE, 7),
    ('ouverture', 'compte', 'Ouvrir le compte professionnel', 'Banque pro.', 1, TRUE, 10),
    ('ouverture', 'assurances', 'Souscrire les assurances essentielles', 'RC pro, locaux…', 2, TRUE, 7)
) AS a(template_slug, slug, title, description, sort_order, is_required, default_duration_days)
  ON t.slug = a.template_slug AND t.stage = 'immatriculation'
ON CONFLICT (template_id, slug) DO NOTHING;

INSERT INTO stage_milestone_templates (stage, slug, title, description, offset_days, sort_order)
VALUES
  ('immatriculation', 'choix-forme', 'Forme choisie', 'Structure juridique arrêtée.', 0, 1),
  ('immatriculation', 'dossier-complet', 'Dossier complet', 'Pièces prêtes au dépôt.', 14, 2),
  ('immatriculation', 'depot', 'Dépôt effectué', 'Dossier transmis.', 21, 3),
  ('immatriculation', 'immat', 'Immatriculation reçue', 'Kbis / SIREN obtenu.', 35, 4),
  ('immatriculation', 'compte-pro', 'Compte pro ouvert', 'Opérationnel bancaire.', 42, 5)
ON CONFLICT (stage, slug) DO NOTHING;

-- ── Lancement ────────────────────────────────────────────────────
INSERT INTO stage_workflow_templates (stage, slug, title, description, sort_order, is_required)
VALUES
  ('lancement', 'offre-live', 'Offre live', 'Première version commercialisable.', 1, TRUE),
  ('lancement', 'acquisition', 'Acquisition', 'Premiers clients / prospects.', 2, TRUE),
  ('lancement', 'ops', 'Opérations', 'Process, outils, qualité.', 3, TRUE),
  ('lancement', 'pilotage', 'Pilotage', 'Indicateurs et rituels.', 4, TRUE),
  ('lancement', 'bilan', 'Bilan de lancement', 'Retours et ajustements.', 5, TRUE)
ON CONFLICT (stage, slug) DO NOTHING;

INSERT INTO stage_workflow_actions (template_id, slug, title, description, sort_order, is_required, default_duration_days)
SELECT t.id, a.slug, a.title, a.description, a.sort_order, a.is_required, a.default_duration_days
FROM stage_workflow_templates t
JOIN (
  VALUES
    ('offre-live', 'mvp', 'Mettre en ligne / prête l''offre MVP', 'Version minimale vendable.', 1, TRUE, 14),
    ('offre-live', 'parcours', 'Tester le parcours client', 'De la découverte au paiement.', 2, TRUE, 7),
    ('acquisition', 'canal', 'Activer un canal d''acquisition', 'Ads, réseau, partenariats…', 1, TRUE, 10),
    ('acquisition', 'clients', 'Obtenir les premiers clients / leads', 'Objectif concret (ex. 3).', 2, TRUE, 21),
    ('ops', 'process', 'Documenter le process de livraison', 'Checklist opérationnelle.', 1, TRUE, 7),
    ('ops', 'outils', 'Mettre en place les outils du quotidien', 'CRM, facturation, planning.', 2, TRUE, 7),
    ('pilotage', 'kpi', 'Définir 3 KPI de lancement', 'CA, leads, satisfaction…', 1, TRUE, 3),
    ('pilotage', 'rituel', 'Instaurer un point hebdo', 'Revue courte de progression.', 2, TRUE, 7),
    ('bilan', 'retours', 'Collecter les retours clients', 'Améliorations prioritaires.', 1, TRUE, 14),
    ('bilan', 'ajuster', 'Ajuster offre ou process', 'Itération post-lancement.', 2, TRUE, 10)
) AS a(template_slug, slug, title, description, sort_order, is_required, default_duration_days)
  ON t.slug = a.template_slug AND t.stage = 'lancement'
ON CONFLICT (template_id, slug) DO NOTHING;

INSERT INTO stage_milestone_templates (stage, slug, title, description, offset_days, sort_order)
VALUES
  ('lancement', 'go-live', 'Go-live', 'Offre disponible.', 0, 1),
  ('lancement', 'premier-client', 'Premier client / lead', 'Première traction.', 14, 2),
  ('lancement', 'ops-stables', 'Ops stabilisées', 'Process en place.', 28, 3),
  ('lancement', 'revue-30j', 'Revue J+30', 'Bilan du premier mois.', 30, 4),
  ('lancement', 'lancement-ok', 'Lancement validé', 'Étape bouclée.', 45, 5)
ON CONFLICT (stage, slug) DO NOTHING;
