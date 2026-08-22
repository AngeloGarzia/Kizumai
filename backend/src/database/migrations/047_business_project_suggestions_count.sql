-- Nombre de projets business proposés par l'IA dans le parcours "Créer son avenir".
-- Exposé dans l'administration, tuile "Règles métier".
INSERT INTO app_settings ("key", value)
SELECT 'business_project_suggestions_count', '3'
FROM (SELECT 1) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings WHERE "key" = 'business_project_suggestions_count'
);