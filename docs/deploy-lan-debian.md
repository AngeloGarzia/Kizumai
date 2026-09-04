# Déploiement LAN (Debian + Docker)

Accès depuis le réseau local : **http://192.168.1.11/kizumai**

> Guide complet (install, mises à jour dev → Debian, dépannage) : **[README-deploiement-lan.md](./README-deploiement-lan.md)**

## Prérequis sur le serveur Debian

- Docker + Docker Compose
- Ports **80** ouvert sur le LAN (ou changer `LAN_HTTP_PORT`)

## Installation

```bash
git clone <repo> kizumai && cd kizumai

cp .env.lan.example .env
cp backend/.env.production.lan.example backend/.env.production.lan
```

Éditer `.env` (mots de passe Postgres/Redis) et `backend/.env.production.lan` (JWT, clés IA, VAPID, SMTP).

```bash
docker compose -f docker-compose.lan.yml up -d --build
```

## Vérification

- Frontend : http://192.168.1.11/kizumai
- API : http://192.168.1.11/kizumai/api/health (si route health existe)

Depuis un autre PC du réseau, ouvrir la même URL dans le navigateur.

## Changer l’IP

Modifier `LAN_PUBLIC_URL` dans `.env` puis reconstruire le frontend :

```bash
docker compose -f docker-compose.lan.yml up -d --build web
```

Mettre à jour aussi `CORS_ORIGIN`, `APP_URL` dans `backend/.env.production.lan`.
