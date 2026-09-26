# Migrations SQL — Kizumai

Fichiers appliqués dans l’ordre lexicographique par `runMigrations()`
(`schema_migrations` enregistre chaque `filename` déjà joué).

## Numéro 011 volontairement absent

Il n’existe **pas** de fichier `011_*.sql`. La séquence passe de
`010_add_ai_provider_setting.sql` à `012_rename_brand_sorakai.sql`.

Cause : une migration 011 a été abandonnée / annulée avant merge.
**Ne pas** inventer un `011_*.sql` a posteriori ni renuméroter les
migrations déjà déployées (risque de désynchroniser les bases existantes).

Si une nouvelle migration est nécessaire, utiliser le prochain numéro libre
après le dernier fichier présent (actuellement ≥ 075).
