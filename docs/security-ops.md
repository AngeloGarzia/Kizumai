# Guide déploiement sécurisé (extraits)

## Secrets

1. Copier `.env.docker.example` → `.env` (racine) et `backend/.env.production.example` → `backend/.env.production`.
2. Générer des secrets forts : `openssl rand -base64 48`
3. **Révoquer / faire tourner** toute clé API qui aurait été commitée par erreur dans un fichier d’exemple.
4. Ne jamais committer `.env`, `.env.production`, `.env.development`.

## Docker

```bash
# Infra seule (Postgres + Redis, aucun port hôte)
docker compose up -d

# Dev local (ports 127.0.0.1 uniquement)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# API (profil app)
docker compose --profile app up -d --build
```

- Postgres / Redis : réseau Docker interne ; overlay dev = bind `127.0.0.1` seulement.
- Redis : `requirepass` + commandes dangereuses renommées.
- Compte Postgres applicatif `kizumai_app` (pas superuser) via `docker/postgres/init/01-app-user.sh`.
- Conteneurs : `no-new-privileges`, `cap_drop`, user non-root pour l’API.

## Migrations

Exécuter les migrations avec le superuser (ou un rôle DDL), puis laisser l’API utiliser `kizumai_app`.
