# 🚀 Workflow "Deploy Both" - Déploiement simultané Bot + Dashboard

Ce workflow GitHub Actions permet de déployer **à la fois** le bot Discord (`7k-bot`) et le dashboard Next.js (`7k-bot-dashboard`) en une seule action.

## 📋 Comment l'utiliser

### Via l'interface GitHub (méthode recommandée)

1. Aller sur https://github.com/justNuka/7k-bot/actions
2. Dans la liste des workflows, cliquer sur **"Deploy Both (Bot + Dashboard)"**
3. Cliquer sur **"Run workflow"** (bouton à droite)
4. Choisir la branche `main` (sélectionnée par défaut)
5. Cocher/décocher les options de restart si besoin :
   - ✅ **Restart bot after deploy** (recommandé)
   - ✅ **Restart dashboard after deploy** (recommandé)
6. Cliquer sur **"Run workflow"** (bouton vert)

Le workflow va alors :
1. ✅ Déclencher le déploiement du bot (`deploy-artifacts.yml`)
2. ✅ Déclencher le déploiement du dashboard (`deploy.yml`)
3. ⏳ Attendre 2 minutes (le temps que les builds se terminent)
4. 🔄 Redémarrer les deux services via PM2 (si activé)

### Via CLI GitHub (nécessite `gh` installé)

```bash
# Avec restart automatique (par défaut)
gh workflow run "Deploy Both (Bot + Dashboard)" \
  --repo justNuka/7k-bot \
  --ref main \
  -f restart_bot=true \
  -f restart_dashboard=true

# Sans restart (déploiement uniquement)
gh workflow run "Deploy Both (Bot + Dashboard)" \
  --repo justNuka/7k-bot \
  --ref main \
  -f restart_bot=false \
  -f restart_dashboard=false
```

## 🔧 Configuration requise

### GitHub Secrets (dans le repo `7k-bot`)

Le workflow nécessite les secrets suivants :

#### Authentification SSH AlwaysData
- `ALWAYSDATA_HOST` : `ssh-<USER>.alwaysdata.net`
- `ALWAYSDATA_USER` : `<USER>` (votre nom d'utilisateur AlwaysData)
- `ALWAYSDATA_SSH_KEY` : Clé privée SSH (format PEM)

#### Accès inter-repos
- `PAT_ACCESS_DASHBOARD` : Personal Access Token GitHub avec permissions :
  - `Actions: read and write` (pour déclencher le workflow du dashboard)
  - `Contents: read` (pour lire le code du dashboard)

#### Optionnel (notifications Discord)
- `DISCORD_DEPLOY_WEBHOOK` : URL du webhook Discord pour recevoir des notifications de déploiement

### Comment générer les secrets

#### 1. Clé SSH pour AlwaysData

```bash
# Générer une paire de clés
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/alwaysdata_deploy

# Afficher la clé publique (à ajouter dans AlwaysData → Compte → SSH)
cat ~/.ssh/alwaysdata_deploy.pub

# Afficher la clé privée (à copier dans GitHub Secrets → ALWAYSDATA_SSH_KEY)
cat ~/.ssh/alwaysdata_deploy
```

Sur AlwaysData :
1. Aller dans **Compte** → **SSH**
2. Cliquer **"Ajouter une clé SSH"**
3. Coller la clé publique
4. Valider

Sur GitHub :
1. Aller dans **Settings** → **Secrets and variables** → **Actions**
2. Cliquer **"New repository secret"**
3. Nom : `ALWAYSDATA_SSH_KEY`
4. Valeur : Coller la clé privée complète (y compris `-----BEGIN OPENSSH PRIVATE KEY-----`)
5. Valider

#### 2. Personal Access Token (PAT)

Sur GitHub :
1. Aller dans **Settings** (votre profil) → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
2. Cliquer **"Generate new token"**
3. Nom : `GitHub Actions - Deploy Dashboard`
4. Expiration : 90 jours (ou personnalisé)
5. Repository access : **Only select repositories** → Choisir `7k-bot-dashboard`
6. Permissions :
   - **Actions** : `Read and write`
   - **Contents** : `Read-only`
7. Générer et copier le token

Ensuite, dans le repo `7k-bot` :
1. **Settings** → **Secrets and variables** → **Actions**
2. **"New repository secret"**
3. Nom : `PAT_ACCESS_DASHBOARD`
4. Valeur : Coller le token
5. Valider

## 📊 Architecture du workflow

```mermaid
graph LR
    A[Trigger manuel] --> B[Job: trigger-bot-deploy]
    A --> C[Job: trigger-dashboard-deploy]
    B --> D[Workflow bot: deploy-artifacts.yml]
    C --> E[Workflow dashboard: deploy.yml]
    D --> F[Job: wait-and-restart]
    E --> F
    F --> G[Wait 2 minutes]
    G --> H[SSH restart PM2]
```

### Étapes détaillées

1. **trigger-bot-deploy** (Job 1)
   - Utilise l'API GitHub pour déclencher `deploy-artifacts.yml` du repo `7k-bot`
   - Token : `GITHUB_TOKEN` (permissions du repo courant)

2. **trigger-dashboard-deploy** (Job 2)
   - Utilise l'API GitHub pour déclencher `deploy.yml` du repo `7k-bot-dashboard`
   - Token : `PAT_ACCESS_DASHBOARD` (permissions inter-repos)

3. **wait-and-restart** (Job 3, conditionnel)
   - Attend la fin des jobs 1 et 2
   - Attend 2 minutes supplémentaires (temps de build estimé)
   - Se connecte en SSH à AlwaysData
   - Exécute `pm2 restart 7k-bot` et `pm2 restart dashboard`

## 🐛 Troubleshooting

### Le workflow échoue avec "Workflow does not exist"

**Cause** : Le nom du fichier workflow est incorrect ou le workflow n'existe pas dans le repo cible.

**Solution** :
```bash
# Vérifier que les workflows existent
ls -la 7k-bot/.github/workflows/
ls -la 7k-bot-dashboard/.github/workflows/

# Nom attendu : deploy-artifacts.yml (bot) et deploy.yml (dashboard)
```

### Le workflow échoue avec "Not Found" ou "Bad credentials"

**Cause** : `PAT_ACCESS_DASHBOARD` manquant, expiré ou permissions insuffisantes.

**Solution** :
1. Vérifier que le secret existe : **Settings** → **Secrets and variables** → **Actions**
2. Régénérer un nouveau PAT avec les bonnes permissions
3. Mettre à jour le secret

### Le restart échoue avec "pm2: command not found"

**Cause** : PM2 n'est pas installé sur AlwaysData.

**Solution** :
```bash
ssh <USER>@ssh-<USER>.alwaysdata.net
npm install -g pm2

# Démarrer les apps avec PM2
cd ~/apps/7k-bot
pm2 start dist/index.js --name 7k-bot

cd ~/apps/7k-bot-dashboard
pm2 start npm --name dashboard -- start

# Sauvegarder la config
pm2 save
pm2 startup
```

### Les workflows se déclenchent mais les apps ne redémarrent pas

**Cause** : Le délai de 2 minutes est insuffisant ou PM2 n'est pas configuré.

**Solution** :
1. Augmenter le délai dans `.github/workflows/deploy-both.yml` :
   ```yaml
   - name: ⏳ Wait for deployments to complete
     run: sleep 180  # 3 minutes au lieu de 2
   ```

2. Vérifier les logs PM2 :
   ```bash
   pm2 logs 7k-bot --lines 50
   pm2 logs dashboard --lines 50
   ```

3. Si PM2 ne fonctionne pas, utiliser l'interface AlwaysData pour redémarrer manuellement.

## 🎯 Alternatives au workflow "Deploy Both"

### Déclencher via commit message (pas encore actif)

```bash
# Dans le repo bot
git commit -m "feat: nouvelle fonctionnalité [deploy]"
git push

# Dans le repo dashboard
git commit -m "style: amélioration UI [deploy]"
git push
```

Actuellement, les workflows individuels ne se déclenchent que sur `workflow_dispatch` (manuel). Pour activer le déclenchement automatique sur commit, décommenter les lignes dans `deploy-artifacts.yml` et `deploy.yml` :

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

### Script local (déploiement complet depuis votre machine)

```bash
# Clone ce repo si pas déjà fait
git clone https://github.com/justNuka/7k-bot.git
cd 7k-bot

# Exécuter le script de déploiement
./scripts/deploy-remote.sh
```

(Script à créer si besoin)

## 📝 Notes

- Les workflows individuels (`deploy-artifacts.yml` et `deploy.yml`) peuvent toujours être déclenchés séparément
- Le workflow "Deploy Both" est idéal pour les mises à jour majeures affectant bot + dashboard
- Les restarts automatiques nécessitent PM2 configuré sur AlwaysData
- Les notifications Discord sont optionnelles (secret `DISCORD_DEPLOY_WEBHOOK`)

---

**Dernière mise à jour** : 9 novembre 2025  
**Auteur** : 7K Bot Team
