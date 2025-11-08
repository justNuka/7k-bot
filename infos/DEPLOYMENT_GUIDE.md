# 🚀 Guide de déploiement - Bot & Dashboard

Ce guide explique comment déployer le bot Discord et le dashboard Next.js sur AlwaysData, ainsi que comment les redémarrer.

## 📋 Table des matières

1. [Déploiement automatique (GitHub Actions)](#deploiement-automatique)
2. [Déploiement manuel (SSH)](#deploiement-manuel)
3. [Restart du bot depuis le dashboard](#restart-du-bot)
4. [Configuration AlwaysData](#configuration-alwaysdata)
5. [Troubleshooting](#troubleshooting)

---

## 🤖 Déploiement automatique (GitHub Actions)

### Option 1 : Déployer bot + dashboard en même temps

Via l'interface GitHub :
1. Aller sur https://github.com/justNuka/7k-bot/actions
2. Cliquer sur "Deploy Both (Bot + Dashboard)"
3. Cliquer "Run workflow" → Choisir `main` → Run
4. ✅ Les deux repos sont déployés automatiquement

Via commit message (pas encore activé) :
```bash
git commit -m "feat: nouvelle fonctionnalité [deploy]"
git push
```
→ Le tag `[deploy]` déclenche les workflows automatiquement.

### Option 2 : Déployer uniquement le bot

```bash
cd 7k-bot
git commit -m "fix: correction bug [deploy]"
git push
```
→ Workflow `deploy-artifacts.yml` se déclenche.

### Option 3 : Déployer uniquement le dashboard

```bash
cd 7k-bot-dashboard
git commit -m "style: amélioration UI [deploy]"
git push
```
→ Workflow `deploy.yml` se déclenche.

---

## 🔧 Déploiement manuel (SSH)

### Déployer le bot

```bash
ssh <USER>@ssh-<USER>.alwaysdata.net

cd ~/apps/7k-bot
git pull origin main
npm ci --production=false
npm run build
npm prune --omit=dev

# Restart via PM2 (si installé)
pm2 restart 7k-bot
# OU via interface AlwaysData
```

### Déployer le dashboard

```bash
ssh <USER>@ssh-<USER>.alwaysdata.net

cd ~/apps/7k-bot-dashboard
git pull origin main
npm ci
npm run build

# Restart via PM2 (si installé)
pm2 restart dashboard
# OU via interface AlwaysData
```

### Script tout-en-un (recommandé)

Créer `~/scripts/deploy-all.sh` :

```bash
#!/bin/bash
set -e

echo "🤖 Deploying bot..."
cd ~/apps/7k-bot
git pull origin main
npm ci --production=false
npm run build
npm prune --omit=dev

echo "🌐 Deploying dashboard..."
cd ~/apps/7k-bot-dashboard
git pull origin main
npm ci
npm run build

echo "🔄 Restarting services..."
if command -v pm2 &> /dev/null; then
  pm2 restart 7k-bot
  pm2 restart dashboard
  pm2 save
else
  echo "⚠️ PM2 not installed, manual restart required"
fi

echo "✅ Deployment complete!"
```

Utilisation :
```bash
bash ~/scripts/deploy-all.sh
```

---

## 🔄 Restart du bot depuis le dashboard

### Via l'interface web (recommandé)

1. Se connecter au dashboard : https://7k-bot.alwaysdata.net/
2. Aller sur la page d'accueil ou logs
3. Cliquer sur le bouton "Restart Bot" (🔴 en haut à droite)
4. Confirmer l'action
5. ✅ Le bot redémarre automatiquement en ~15 secondes

**Composant** : `src/components/RestartBotButton.tsx`  
**API** : `POST /api/bot/restart` (dashboard) → `POST /admin/restart` (bot)

### Via l'API directement

```bash
# Depuis le dashboard (authentifié)
curl -X POST https://7k-bot.alwaysdata.net/api/bot/restart \
  -H "Cookie: next-auth.session-token=<TOKEN>"

# Depuis le bot (avec API key)
curl -X POST http://localhost:8787/admin/restart \
  -H "x-api-key: <DASH_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"triggered_by": "admin", "timestamp": "2025-11-09T..."}'
```

### Via SSH/PM2

```bash
ssh <USER>@ssh-<USER>.alwaysdata.net
pm2 restart 7k-bot
pm2 logs 7k-bot --lines 50
```

---

## ⚙️ Configuration AlwaysData

### Prérequis

1. **Applications créées** dans l'interface AlwaysData :
   - **Bot** : Application Node.js (daemon/processus persistant)
     - Commande : `npm start` ou `node dist/index.js`
     - Working dir : `/home/<USER>/apps/7k-bot`
   - **Dashboard** : Application Node.js (web)
     - Commande : `npm start`
     - Working dir : `/home/<USER>/apps/7k-bot-dashboard`
     - Domaine lié (ex: `7k-bot.alwaysdata.net`)

2. **PM2 installé** (optionnel mais recommandé) :
   ```bash
   npm install -g pm2
   
   # Démarrer le bot
   cd ~/apps/7k-bot
   pm2 start dist/index.js --name 7k-bot
   
   # Démarrer le dashboard
   cd ~/apps/7k-bot-dashboard
   pm2 start npm --name dashboard -- start
   
   # Sauvegarder la config PM2
   pm2 save
   pm2 startup  # Configure auto-restart au boot
   ```

3. **Variables d'environnement** :
   - **Bot** : `.env` dans `/home/<USER>/apps/7k-bot/`
   - **Dashboard** : `.env` dans `/home/<USER>/apps/7k-bot-dashboard/`
   
   Voir `.env.example` dans chaque repo pour la liste complète.

4. **GitHub Secrets** (pour CI/CD) :
   - `ALWAYSDATA_HOST` : `ssh-<USER>.alwaysdata.net`
   - `ALWAYSDATA_USER` : `<USER>`
   - `ALWAYSDATA_SSH_KEY` : Clé privée SSH (générer avec `ssh-keygen`)
   - `PAT_ACCESS_DASHBOARD` : Personal Access Token GitHub (pour accéder au repo dashboard depuis le workflow bot)
   - `DISCORD_DEPLOY_WEBHOOK` : Webhook Discord (optionnel, pour notifications)

---

## 🐛 Troubleshooting

### Le bot ne redémarre pas après déploiement

**Cause** : PM2 non installé ou application AlwaysData non configurée.

**Solution** :
```bash
ssh <USER>@ssh-<USER>.alwaysdata.net
cd ~/apps/7k-bot
pm2 restart 7k-bot
# OU
pm2 start dist/index.js --name 7k-bot
```

### Le dashboard affiche une erreur 502

**Cause** : Le dashboard n'est pas démarré ou le port est incorrect.

**Solution** :
```bash
ssh <USER>@ssh-<USER>.alwaysdata.net
cd ~/apps/7k-bot-dashboard
pm2 restart dashboard
pm2 logs dashboard --lines 50
```

Vérifier que `NEXTAUTH_URL` dans `.env` correspond au domaine AlwaysData.

### GitHub Actions échoue avec "Permission denied"

**Cause** : La clé SSH n'est pas correctement configurée.

**Solution** :
1. Générer une nouvelle clé SSH :
   ```bash
   ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/alwaysdata_deploy
   ```
2. Ajouter la clé publique dans AlwaysData → Compte → SSH
3. Copier la clé privée dans GitHub Secrets → `ALWAYSDATA_SSH_KEY`

### Le workflow "Deploy Both" ne déclenche rien

**Cause** : `PAT_ACCESS_DASHBOARD` manquant ou permissions insuffisantes.

**Solution** :
1. Créer un Personal Access Token sur GitHub : Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Permissions : `Actions: read and write`, `Contents: read`
3. Ajouter dans GitHub Secrets → `PAT_ACCESS_DASHBOARD`

### Le restart bot depuis le dashboard ne fonctionne pas

**Cause** : `BOT_API_URL` ou `DASH_API_KEY` incorrect dans le dashboard.

**Solution** :
```bash
# Vérifier les env vars
cd ~/apps/7k-bot-dashboard
cat .env | grep BOT_API_URL
cat .env | grep DASH_API_KEY

# Comparer avec le bot
cd ~/apps/7k-bot
cat .env | grep DASH_API_KEY
```

Les deux `DASH_API_KEY` doivent être identiques.

---

## 📊 Logs et monitoring

### Voir les logs du bot

```bash
# Via PM2
pm2 logs 7k-bot --lines 100

# Via fichiers logs (si configurés)
tail -f ~/apps/7k-bot/logs/bot.log
```

### Voir les logs du dashboard

```bash
# Via PM2
pm2 logs dashboard --lines 100

# Via l'interface web
# Aller sur https://7k-bot.alwaysdata.net/logs/live
```

### Health check

```bash
# Bot
curl http://localhost:8787/health

# Dashboard
curl https://7k-bot.alwaysdata.net/api/health
```

---

## 🎯 Résumé des commandes utiles

```bash
# Déploiement complet
bash ~/scripts/deploy-all.sh

# Restart rapide
pm2 restart all

# Voir le statut
pm2 status

# Voir les logs en temps réel
pm2 logs --lines 50

# Sauvegarder la config PM2
pm2 save

# Health check
curl http://localhost:8787/health
curl https://7k-bot.alwaysdata.net/api/health
```

---

**Dernière mise à jour** : 9 novembre 2025  
**Auteur** : 7K Bot Team
