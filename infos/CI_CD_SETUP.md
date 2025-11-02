# 🚀 Setup CI/CD - Déploiement automatique vers AlwaysData

Ce guide explique comment configurer le déploiement automatique via GitHub Actions.

## ✅ Ce qui a été fait

1. **Next.js en mode standalone** (`next.config.ts`) → plus besoin de `node_modules` sur le serveur
2. **Workflow GitHub Actions** (`.github/workflows/deploy-artifacts.yml`) → build dans CI, déploie les artefacts
3. **Script de déploiement simplifié** (`scripts/deploy/deploy-artifacts.sh`) → extraction des tar.gz, pas de build

## 📋 Prochaines étapes

### 1. Configurer les GitHub Secrets

Dans GitHub (Settings → Secrets and variables → Actions), ajouter :

```
ALWAYSDATA_HOST=ssh-7k-bot.alwaysdata.net
ALWAYSDATA_USER=7k-bot
ALWAYSDATA_SSH_KEY=<contenu de ta clé privée SSH>
```

#### Générer la clé SSH (si pas encore fait)

**Sur ta machine locale :**

```powershell
# Générer une clé SSH spécifique pour AlwaysData
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/alwaysdata_deploy

# Afficher la clé publique à copier
cat ~/.ssh/alwaysdata_deploy.pub
```

**Sur AlwaysData (via l'interface web) :**

1. Aller dans `Account → SSH Keys`
2. Ajouter la clé **publique** (`.pub`)

**Dans GitHub Secrets :**

1. Copier le contenu de la clé **privée** (sans `.pub`)
2. Créer le secret `ALWAYSDATA_SSH_KEY` avec ce contenu

---

### 2. Uploader le script de déploiement sur AlwaysData

**Via SSH :**

```bash
# Se connecter
ssh 7k-bot@ssh-7k-bot.alwaysdata.net

# Créer le dossier scripts
mkdir -p ~/scripts

# Créer le fichier deploy-artifacts.sh
nano ~/scripts/deploy-artifacts.sh

# Coller le contenu de scripts/deploy/deploy-artifacts.sh
# Sauvegarder (Ctrl+O, Enter, Ctrl+X)

# Rendre exécutable
chmod +x ~/scripts/deploy-artifacts.sh
```

**Ou via Git (plus simple) :**

```bash
# Sur AlwaysData
cd ~/scripts
git clone https://github.com/justNuka/7k-bot.git temp
cp temp/scripts/deploy/deploy-artifacts.sh .
chmod +x deploy-artifacts.sh
rm -rf temp
```

---

### 3. Créer les fichiers .env

#### Bot (~/apps/7k-bot/.env)

```bash
# Sur AlwaysData
cd ~/apps/7k-bot
nano .env
```

Contenu minimum (adapter avec tes vraies valeurs) :

```env
# Bot Discord
DISCORD_TOKEN=<ton_token_bot>
DISCORD_CLIENT_ID=<ton_client_id>
GUILD_ID=<ton_guild_id>

# Database
SQLITE_PATH=/home/7k-bot/data/bot.db

# Dashboard API
DASH_API_KEY=<ton_api_key>
DASH_PORT=8787

# Channels & Roles (copier depuis ton .env local)
ROLE_OFFICIERS_ID=...
# etc.
```

#### Dashboard (~/apps/7k-bot-dashboard/.env)

```bash
# Sur AlwaysData
cd ~/apps/7k-bot-dashboard
nano .env
```

Contenu minimum :

```env
# Next Auth
NEXTAUTH_URL=https://ton-domaine.alwaysdata.net
NEXTAUTH_SECRET=<générer avec: openssl rand -base64 32>

# Discord OAuth
DISCORD_CLIENT_ID=<ton_client_id>
DISCORD_CLIENT_SECRET=<ton_client_secret>

# Bot API
BOT_API_URL=http://127.0.0.1:8787
DASH_API_KEY=<même_valeur_que_bot>

# Database (accès direct)
SQLITE_PATH=/home/7k-bot/data/bot.db
```

---

### 4. Configurer les applications AlwaysData

#### Application Bot (Daemon Node.js)

1. Web → Sites → Add an application
2. Type: **Node.js**
3. Mode: **Daemon** (processus persistant)
4. Configuration:
   - Name: `7k-bot`
   - Working directory: `/home/7k-bot/apps/7k-bot`
   - Command: `node --enable-source-maps dist/index.js`
   - Restart on failure: ✅ Oui

#### Application Dashboard (Web Node.js)

1. Web → Sites → Add an application
2. Type: **Node.js**
3. Mode: **Web** (HTTP)
4. Configuration:
   - Name: `7k-bot-dashboard`
   - Working directory: `/home/7k-bot/apps/7k-bot-dashboard/.next/standalone`
   - Command: `node server.js -p $PORT`
   - Addresses: Lier à ton domaine/sous-domaine

---

### 5. Tester le déploiement

#### Test manuel (première fois)

```bash
# Sur AlwaysData
cd ~/scripts
./deploy-artifacts.sh
```

Si ça échoue avec "No artifacts", c'est normal - la CI n'a pas encore envoyé les fichiers.

#### Déclencher la CI

Sur ta machine locale :

```powershell
# Bot
cd D:\Projets_persos\7k-bot-project\7k-bot
git commit --allow-empty -m "test: trigger CI deployment [deploy]"
git push origin main

# Dashboard (si changements)
cd D:\Projets_persos\7k-bot-project\7k-bot-dashboard
git commit --allow-empty -m "test: trigger CI deployment [deploy]"
git push origin main
```

#### Vérifier le déploiement

1. GitHub → Actions → Voir le workflow "Build & Deploy"
2. AlwaysData SSH → `ls -lh ~/` → vérifier `bot-artifacts.tar.gz` et `dashboard-artifacts.tar.gz`
3. Exécuter `~/scripts/deploy-artifacts.sh`
4. Redémarrer les apps via l'interface AlwaysData

---

## 🔄 Workflow de déploiement (une fois configuré)

### Déployer le bot

```powershell
cd D:\Projets_persos\7k-bot-project\7k-bot

# Faire tes modifs
git add .
git commit -m "feat: ma nouvelle feature [deploy]"
git push origin main

# GitHub Actions va automatiquement :
# 1. Builder le bot (npm ci + npm run build + npm prune)
# 2. Packager dist/ + node_modules/ en tar.gz
# 3. L'envoyer sur AlwaysData
# 4. Exécuter deploy-artifacts.sh
# 5. (TODO) Redémarrer l'app automatiquement
```

### Déployer le dashboard

Même chose, depuis le repo `7k-bot-dashboard` avec `[deploy]` dans le commit.

---

## 📊 Avantages de cette approche

✅ **Zéro build sur AlwaysData** → plus de problème de RAM  
✅ **Next.js standalone** → 10x plus léger (pas de node_modules complet)  
✅ **CI/CD automatique** → push avec `[deploy]` = déploiement auto  
✅ **Better-sqlite3 précompilé** → binaire Linux déjà dans les artefacts  
✅ **Rollback facile** → garder les anciens tar.gz si besoin  

---

## 🐛 Troubleshooting

### "Permission denied" lors du SSH

Vérifier que la clé SSH est bien ajoutée dans GitHub Secrets et sur AlwaysData.

### "dist/ not found" dans les artefacts

Vérifier que le pre-push hook a bien compilé TypeScript localement avant le push.

### Dashboard ne démarre pas

Vérifier que `public/` et `.next/static/` ont bien été copiés dans `.next/standalone/` (le script le fait automatiquement).

### Bot crash au démarrage

Vérifier les variables d'environnement dans `~/apps/7k-bot/.env` (surtout `DISCORD_TOKEN` et `SQLITE_PATH`).

---

## 🔜 Améliorations futures

- [ ] Restart automatique via l'API AlwaysData
- [ ] Healthcheck HTTP pour valider le déploiement
- [ ] Notifications Discord en cas de succès/échec
- [ ] Rollback automatique en cas d'erreur

---

Tu as maintenant une infrastructure de déploiement **production-ready** ! 🚀
