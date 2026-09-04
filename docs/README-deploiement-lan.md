# Kizumai — Déploiement LAN (Debian)

Guide pour **installer**, **mettre à jour** et **dépanner** Kizumai sur un serveur Debian du réseau local.

**URL cible :** http://192.168.1.11/kizumai

---

## Architecture

| Service   | Conteneur          | Rôle                          |
|-----------|--------------------|-------------------------------|
| `gateway` | `kizumai-gateway`  | Nginx public (port 80)        |
| `web`     | `kizumai-web`      | Frontend React (build Vite)   |
| `api`     | `kizumai-api`      | Backend Express               |
| `postgres`| `kizumai-postgres` | PostgreSQL + pgvector         |
| `redis`   | `kizumai-redis`    | Files BullMQ                  |

Fichier Compose autonome : **`docker-compose.lan.yml`** (ne pas combiner avec `docker-compose.yml`).

---

## Fichiers de configuration (serveur)

Deux fichiers **locaux au serveur** — ne pas committer avec de vrais secrets :

| Fichier | Contenu |
|---------|---------|
| `~/kizumai/.env` | Mots de passe Postgres / Redis, `LAN_PUBLIC_URL` |
| `~/kizumai/backend/.env.production.lan` | JWT, IA, CORS, admin initial, `DB_SSL=false` |

Modèles : `.env.lan.example` et `backend/.env.production.lan.example`.

---

## Première installation

```bash
git clone https://github.com/AngeloGarzia/Kizumai.git kizumai && cd kizumai

cp .env.lan.example .env
cp backend/.env.production.lan.example backend/.env.production.lan
```

1. Éditer **`.env`** — mots de passe forts (de préférence `openssl rand -hex 24`).
2. Éditer **`backend/.env.production.lan`** — JWT, clés IA, et :
   ```env
   ALLOW_INSECURE_CORS=true
   CORS_ORIGIN=http://192.168.1.11
   APP_URL=http://192.168.1.11
   APP_BASE_PATH=/kizumai
   DB_SSL=false
   ADMIN_EMAIL=admin@kizumai.fr
   ADMIN_PASSWORD=<mot de passe admin choisi par vous>
   ```

3. Permissions init Postgres (obligatoire après `scp` depuis Windows) :
   ```bash
   chmod 755 docker/postgres docker/postgres/init
   chmod 755 docker/postgres/init/01-app-user.sh
   sed -i 's/\r$//' docker/postgres/init/*.sh docker/postgres/init/*.sql
   ```

4. Lancer la stack :
   ```bash
   sudo docker compose -f docker-compose.lan.yml up -d --build
   ```

5. Vérifier :
   ```bash
   curl -s http://192.168.1.11/kizumai/api/health
   # {"status":"ok"}
   ```

Connexion : **http://192.168.1.11/kizumai** avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## Mettre à jour après des modifs en dev

Workflow quotidien **Windows → Debian** :

### 1. Sur le PC de dev (Windows)

```powershell
cd C:\Users\dell\Kizumai
git add .
git commit -m "Description du changement"
git push
```

### 2. Sur le serveur Debian

```bash
cd ~/kizumai
git pull
sudo docker compose -f docker-compose.lan.yml up -d --build
```

Les **migrations SQL** s’appliquent automatiquement au démarrage de l’API.

### Rebuild ciblé (plus rapide)

| Modifié | Commande |
|---------|----------|
| Backend seulement | `sudo docker compose -f docker-compose.lan.yml up -d --build api` |
| Frontend seulement | `sudo docker compose -f docker-compose.lan.yml up -d --build web` |
| Gateway nginx | `sudo docker compose -f docker-compose.lan.yml up -d --force-recreate gateway` |
| Variable `LAN_PUBLIC_URL` | Rebuild **web** + mettre à jour `CORS_ORIGIN` / `APP_URL` dans `.env.production.lan` |

### 3. Vérification

```bash
sudo docker compose -f docker-compose.lan.yml ps
curl -s http://192.168.1.11/kizumai/api/health
sudo docker logs kizumai-api --tail 20
```

Dans le navigateur : **Ctrl+F5** après un rebuild frontend.

---

## Ce qui est préservé entre les mises à jour

| Donnée | Stockage |
|--------|----------|
| Base PostgreSQL | Volume Docker `kizumai_postgres_data` |
| Redis (queues) | Volume `kizumai_redis_data` |
| Comptes / projets | En base ( Postgres ) |
| Fichiers uploadés | `/app/uploads` (tmpfs du conteneur API — voir sauvegarde) |
| Secrets prod | Fichiers `.env` locaux (non écrasés par `git pull`) |

---

## Sauvegarde base de données

```bash
sudo docker exec kizumai-postgres pg_dump -U kizumai kizumai > ~/kizumai-backup-$(date +%F).sql
```

Restauration :

```bash
cat ~/kizumai-backup-YYYY-MM-DD.sql | sudo docker exec -i kizumai-postgres psql -U kizumai -d kizumai
```

---

## Alternative : copie manuelle (scp)

Si le code n’est pas encore poussé sur GitHub :

```powershell
# Exemple — un fichier backend
scp C:\Users\dell\Kizumai\backend\src\services\MonService.js angelo@192.168.1.11:~/kizumai/backend/src/services/

# Exemple — compose ou nginx
scp C:\Users\dell\Kizumai\docker-compose.lan.yml angelo@192.168.1.11:~/kizumai/
scp C:\Users\dell\Kizumai\frontend\nginx.lan.conf angelo@192.168.1.11:~/kizumai/frontend/
```

Puis rebuild du service concerné sur le Debian.

---

## Compte administrateur

- Créé **une seule fois** au premier démarrage réussi de l’API (`ADMIN_EMAIL` + `ADMIN_PASSWORD` dans `.env.production.lan`).
- Vérifier en base :
  ```bash
  sudo docker exec kizumai-postgres psql -U kizumai -d kizumai -c "SELECT email, role FROM users;"
  ```
- Les autres utilisateurs passent par **Inscription** ou l’interface admin.

---

## Dépannage rapide

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| `502 Bad Gateway` | API down / redémarre | `sudo docker logs kizumai-api --tail 40` |
| `permission denied` sur init Postgres | Dossier `docker/postgres/init` en `700` | `chmod 755 docker/postgres/init` puis recréer le volume si 1ère install |
| `REDIS_URL invalide` | `/` ou `@` dans `REDIS_PASSWORD` | Mot de passe hex dans `.env`, ou pull récent (encode auto) + rebuild `api` |
| `SSL connections` | Postgres Docker sans TLS | `DB_SSL=false` dans `.env.production.lan` |
| `ADMIN_PASSWORD requis` | Seed admin | Ajouter `ADMIN_EMAIL` + `ADMIN_PASSWORD` dans `.env.production.lan`, `--force-recreate api` |
| Extension `vector` | pgvector non installé | `sudo docker exec kizumai-postgres psql -U kizumai -d kizumai -c "CREATE EXTENSION IF NOT EXISTS vector;"` |
| `500` sur assets `/kizumai/` | Ancien `nginx.lan.conf` | Copier le fichier à jour + `up -d --build web` |
| Logo / Fabulous absents | Chemins `/kizumai.png` sans préfixe `/kizumai/` | Rebuild **web** après pull (fix `publicAssetUrl`) |
| « Erreur interne du serveur » (UI) | API 500 sur une route | F12 → Network → URL en rouge ; `docker logs kizumai-api --tail 50` |
| Build web exit 127 | `node_modules` Windows copié | Supprimer `frontend/node_modules` sur le serveur, rebuild avec `.dockerignore` |
| `permission denied` Docker | User pas dans groupe `docker` | `sudo docker compose ...` ou `sudo usermod -aG docker $USER` |

Commandes utiles :

```bash
sudo docker compose -f docker-compose.lan.yml ps
sudo docker compose -f docker-compose.lan.yml logs api --tail 50
sudo docker compose -f docker-compose.lan.yml logs web --tail 30
sudo docker compose -f docker-compose.lan.yml down          # arrêt (données conservées)
sudo docker volume rm kizumai_postgres_data                 # reset DB (destructif)
```

---

## Changer l’adresse IP du serveur

1. `.env` → `LAN_PUBLIC_URL=http://NOUVELLE_IP`
2. `backend/.env.production.lan` → `CORS_ORIGIN` et `APP_URL`
3. Rebuild :
   ```bash
   sudo docker compose -f docker-compose.lan.yml up -d --build web
   sudo docker compose -f docker-compose.lan.yml up -d --force-recreate api gateway
   ```

---

## Checklist release LAN

- [ ] Tests OK en dev local
- [ ] `git push` sur `main` (ou branche de release)
- [ ] `git pull` sur le Debian
- [ ] Rebuild `api` et/ou `web`
- [ ] `curl …/kizumai/api/health` → `ok`
- [ ] Test login + parcours critique dans le navigateur
- [ ] Sauvegarde DB si migration importante

---

Voir aussi : [deploy-lan-debian.md](./deploy-lan-debian.md) (install express).
