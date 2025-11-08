# 🚀 Système de déploiement complet - Résumé

## ✅ Ce qui a été créé

### 1. **Workflow "Deploy Both"** (`.github/workflows/deploy-both.yml`)
Déclenche le déploiement du bot ET du dashboard en une seule action.

**Comment l'utiliser :**
1. Aller sur https://github.com/justNuka/7k-bot/actions
2. Cliquer sur "Deploy Both (Bot + Dashboard)"
3. Cliquer "Run workflow"
4. Choisir les options de restart
5. ✅ Les deux sont déployés automatiquement

### 2. **API Restart Bot** (`POST /admin/restart`)
Endpoint dans le bot qui permet de redémarrer via HTTP.

**URL:** `http://localhost:8787/admin/restart` (ou via le dashboard)

**Fonctionnement:**
- Reçoit une requête POST avec `triggered_by` et `timestamp`
- Log l'action dans les logs du bot
- Répond immédiatement avec `{ success: true }`
- Quitte proprement avec `process.exit(0)` après 2 secondes
- PM2 ou systemd redémarre automatiquement le bot

### 3. **Bouton Restart dans le Dashboard** (`RestartBotButton.tsx`)
Bouton rouge "Restart Bot" sur la page d'accueil.

**Fonctionnement:**
- Confirmation obligatoire avant restart
- Appelle `POST /api/bot/restart` (dashboard) → `POST /admin/restart` (bot)
- Affiche des toasts (info → success/error)
- Auto-refresh après 15 secondes
- Loading state pour éviter les clics multiples

**Sécurité:**
- Authentification NextAuth requise
- Rôle officier vérifié via bot API
- API key validée entre dashboard et bot

### 4. **Documentation complète**
- **`infos/DEPLOYMENT_GUIDE.md`** : Guide complet de déploiement (manuel + automatique)
- **`infos/DEPLOY_BOTH_WORKFLOW.md`** : Documentation du workflow "Deploy Both"

---

## 📊 Architecture du système

```
┌─────────────────────────────────────────────────────────────┐
│                      GitHub Actions                         │
│                                                             │
│  ┌──────────────────┐        ┌──────────────────┐          │
│  │  Deploy Bot      │        │  Deploy Dashboard│          │
│  │  (artifacts)     │        │  (Next.js)       │          │
│  └────────┬─────────┘        └────────┬─────────┘          │
│           │                           │                     │
│           └───────────┬───────────────┘                     │
│                       │                                     │
│           ┌───────────▼─────────────┐                       │
│           │  Wait & Restart (SSH)   │                       │
│           │  PM2 restart both       │                       │
│           └─────────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                       │
                       │ SSH
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      AlwaysData                             │
│                                                             │
│  ┌──────────────────┐        ┌──────────────────┐          │
│  │  7k-bot/         │        │  7k-bot-dashboard│          │
│  │  (dist/, node_   │◄───────┤  (.next/, node_  │          │
│  │   modules/)      │  API   │   modules/)      │          │
│  │                  │        │                  │          │
│  │  POST /admin/    │        │  POST /api/bot/  │          │
│  │   restart        │        │   restart        │          │
│  └──────────────────┘        └──────────────────┘          │
│         │ PM2                        │ PM2                  │
│         │ auto-restart               │ auto-restart         │
│         ▼                            ▼                      │
│  [Bot Discord Ready]          [Next.js Server Ready]       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Cas d'usage

### Scénario 1 : Déploiement complet (bot + dashboard)
**Besoin:** Mettre à jour les deux en même temps après une feature majeure.

**Solution:**
1. Aller sur https://github.com/justNuka/7k-bot/actions
2. Workflow "Deploy Both" → Run workflow
3. ✅ Les deux sont déployés et redémarrés

### Scénario 2 : Restart rapide du bot depuis le dashboard
**Besoin:** Le bot bug, besoin de redémarrer rapidement.

**Solution:**
1. Se connecter au dashboard : https://7k-bot.alwaysdata.net/
2. Cliquer sur "Restart Bot" (🔴 sur la page d'accueil)
3. Confirmer
4. ✅ Bot redémarré en 15 secondes

### Scénario 3 : Déploiement d'une seule app
**Besoin:** Mettre à jour seulement le bot ou le dashboard.

**Solution Bot:**
```bash
cd 7k-bot
git add .
git commit -m "fix: correction bug [deploy]"
git push
```
→ Workflow `deploy-artifacts.yml` se déclenche (si activé).

**Solution Dashboard:**
```bash
cd 7k-bot-dashboard
git add .
git commit -m "style: amélioration UI [deploy]"
git push
```
→ Workflow `deploy.yml` se déclenche (si activé).

**Note:** Actuellement, les workflows individuels sont en mode `workflow_dispatch` (manuel uniquement). Pour activer le déploiement auto sur commit, décommenter les lignes `on: push:` dans les workflows.

### Scénario 4 : Déploiement manuel via SSH
**Besoin:** Pas de GitHub Actions disponible, déploiement urgente.

**Solution:**
```bash
ssh <USER>@ssh-<USER>.alwaysdata.net
bash ~/scripts/deploy-all.sh
```

Ou suivre les étapes manuelles dans `infos/DEPLOYMENT_GUIDE.md`.

---

## 🔐 Configuration requise

### GitHub Secrets (repo `7k-bot`)
- ✅ `ALWAYSDATA_HOST` : `ssh-<USER>.alwaysdata.net`
- ✅ `ALWAYSDATA_USER` : `<USER>`
- ✅ `ALWAYSDATA_SSH_KEY` : Clé privée SSH (PEM)
- ✅ `PAT_ACCESS_DASHBOARD` : Personal Access Token (pour déclencher workflow dashboard)
- ⚠️ `DISCORD_DEPLOY_WEBHOOK` : Webhook Discord (optionnel, pour notifications)

### Variables d'environnement (AlwaysData)

**Bot** (`.env` dans `/home/<USER>/apps/7k-bot/`)
```env
DISCORD_TOKEN=...
GUILD_ID=...
ROLE_OFFICIERS_ID=...
DASH_API_KEY=...
DASH_PORT=8787
DASH_HOST=127.0.0.1
SQLITE_PATH=/home/<USER>/data/bot.db
NODE_ENV=production
```

**Dashboard** (`.env` dans `/home/<USER>/apps/7k-bot-dashboard/`)
```env
BOT_API_URL=http://localhost:8787
DASH_API_KEY=...  # (même valeur que bot)
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://7k-bot.alwaysdata.net/
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
SQLITE_PATH=/home/<USER>/data/bot.db
NODE_ENV=production
```

**IMPORTANT:** `DASH_API_KEY` doit être identique dans les deux `.env` !

### PM2 Configuration (AlwaysData)
```bash
# Installer PM2
npm install -g pm2

# Démarrer le bot
cd ~/apps/7k-bot
pm2 start dist/index.js --name 7k-bot

# Démarrer le dashboard
cd ~/apps/7k-bot-dashboard
pm2 start npm --name dashboard -- start

# Sauvegarder la config
pm2 save
pm2 startup
```

---

## 🧪 Tests et validation

### Tester le workflow "Deploy Both"
1. Aller sur https://github.com/justNuka/7k-bot/actions
2. Déclencher "Deploy Both"
3. Vérifier les logs des 3 jobs (trigger-bot-deploy, trigger-dashboard-deploy, wait-and-restart)
4. Se connecter en SSH et vérifier :
   ```bash
   pm2 logs 7k-bot --lines 20
   pm2 logs dashboard --lines 20
   ```

### Tester le restart bot
1. Se connecter au dashboard
2. Vérifier le statut du bot (doit être "online")
3. Cliquer sur "Restart Bot"
4. Confirmer
5. Attendre 15 secondes
6. Vérifier que le bot est toujours "online" (rechargement auto de la page)

### Tester l'API restart directement
```bash
# Via le dashboard (nécessite auth)
curl -X POST https://7k-bot.alwaysdata.net/api/bot/restart \
  -H "Cookie: next-auth.session-token=<TOKEN>"

# Via le bot (avec API key)
curl -X POST http://localhost:8787/admin/restart \
  -H "x-api-key: <DASH_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"triggered_by": "test", "timestamp": "2025-11-09T..."}'
```

---

## 📚 Fichiers créés/modifiés

### Bot (`7k-bot/`)
- ✅ `.github/workflows/deploy-both.yml` (nouveau)
- ✅ `src/http/server.ts` (ajout route `/admin/restart`)
- ✅ `infos/DEPLOYMENT_GUIDE.md` (nouveau)
- ✅ `infos/DEPLOY_BOTH_WORKFLOW.md` (nouveau)

### Dashboard (`7k-bot-dashboard/`)
- ✅ `src/components/RestartBotButton.tsx` (nouveau)
- ✅ `src/app/api/bot/restart/route.ts` (nouveau)
- ✅ `src/app/(dashboard)/page.tsx` (ajout bouton)

---

## 🎉 Résultat

Vous avez maintenant un système de déploiement complet avec :

✅ Déploiement simultané bot + dashboard via GitHub Actions  
✅ Restart du bot depuis le dashboard en un clic  
✅ API de restart sécurisée avec logs  
✅ Documentation complète pour l'équipe  
✅ Confirmation et toasts pour l'UX  
✅ Auto-refresh après restart  
✅ Support PM2 pour auto-restart  

**Prochaines étapes recommandées :**
1. Tester le workflow "Deploy Both" en staging
2. Configurer les secrets GitHub
3. Installer PM2 sur AlwaysData
4. Activer le déploiement auto sur commit (optionnel)
5. Créer un webhook Discord pour les notifications (optionnel)

---

**Commits:**
- Bot : `9c4fd44` - feat: Add deployment system and restart API
- Dashboard : `5f6c4c6` - feat: Add bot restart functionality from dashboard

**Date:** 9 novembre 2025  
**Auteur:** 7K Bot Team
