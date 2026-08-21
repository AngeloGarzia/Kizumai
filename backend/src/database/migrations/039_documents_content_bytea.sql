-- Contenu binaire des documents projet stocké en base (PDF, images, etc.).
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS content BYTEA;

COMMENT ON COLUMN documents.content IS 'Contenu binaire du fichier (source de vérité). storage_key reste une clé logique / legacy disque.';
