#!/bin/bash
# Script de déploiement automatique pour AlwaysData
# Gère 2 repos séparés : 7k-bot et 7k-bot-dashboard

set -e  # Exit on error

# Configuration
REPO_BOT_DIR="/home/$USER/repos/7k-bot"
REPO_DASH_DIR="/home/$USER/repos/7k-bot-dashboard"
APP_BOT_DIR="/home/$USER/apps/7k-bot"
APP_DASH_DIR="/home/$USER/apps/7k-bot-dashboard"
LOG_FILE="/home/$USER/logs/deploy.log"

# Fonction de logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=========================================="
log "🚀 Démarrage déploiement 7k-bot + dashboard"
log "=========================================="

# Vérifier que les repos existent
if [ ! -d "$REPO_BOT_DIR" ]; then
    log "❌ Erreur : Repo bot non trouvé ($REPO_BOT_DIR)"
    exit 1
fi

if [ ! -d "$REPO_DASH_DIR" ]; then
    log "❌ Erreur : Repo dashboard non trouvé ($REPO_DASH_DIR)"
    exit 1
fi

# 1. Git pull BOT (récupérer les derniers changements)
log "📥 Git pull bot..."
cd "$REPO_BOT_DIR"
git fetch origin
git reset --hard origin/main  # Force sync avec main
BOT_COMMIT_MSG=$(git log -1 --pretty=%B)
BOT_COMMIT_HASH=$(git rev-parse --short HEAD)
log "✅ Bot commit: $BOT_COMMIT_HASH - $BOT_COMMIT_MSG"

# 2. Git pull DASHBOARD
log "📥 Git pull dashboard..."
cd "$REPO_DASH_DIR"
git fetch origin
git reset --hard origin/main
DASH_COMMIT_MSG=$(git log -1 --pretty=%B)
DASH_COMMIT_HASH=$(git rev-parse --short HEAD)
log "✅ Dashboard commit: $DASH_COMMIT_HASH - $DASH_COMMIT_MSG"

# 3. Détecter si déploiement nécessaire (au moins un commit avec [deploy])
DEPLOY_BOT=false
DEPLOY_DASH=false

if [[ "$BOT_COMMIT_MSG" =~ \[deploy\] ]]; then
    DEPLOY_BOT=true
    log "🎯 Tag [deploy] détecté pour le BOT"
fi

if [[ "$DASH_COMMIT_MSG" =~ \[deploy\] ]]; then
    DEPLOY_DASH=true
    log "🎯 Tag [deploy] détecté pour le DASHBOARD"
fi

# Si aucun [deploy], skip
if [ "$DEPLOY_BOT" = false ] && [ "$DEPLOY_DASH" = false ]; then
    log "⏭️  Aucun tag [deploy] détecté, skip déploiement"
    exit 0
fi

# 4. Déployer le BOT (si nécessaire)
if [ "$DEPLOY_BOT" = true ]; then
    log "🤖 Déploiement du bot..."
    cd "$APP_BOT_DIR"

    # Backup .env si existe
    if [ -f ".env" ]; then
        cp .env .env.backup
        log "💾 Backup .env bot créé"
    fi

    # Copier les fichiers depuis le repo bot (sauf node_modules, .env, data)
    rsync -av --delete \
        --exclude 'node_modules' \
        --exclude '.env' \
        --exclude 'src/data' \
        --exclude '.git' \
        "$REPO_BOT_DIR/" "$APP_BOT_DIR/"

    # Restaurer .env
    if [ -f ".env.backup" ]; then
        mv .env.backup .env
    fi

    # Install dependencies (prod only)
    log "📦 Installation des dépendances bot..."
    npm ci --only=production

    # Build TypeScript
    log "🔨 Build TypeScript bot..."
    npm run build
    
    log "✅ Bot déployé avec succès"
else
    log "⏭️  Skip déploiement bot (pas de [deploy])"
fi

# 5. Déployer le DASHBOARD (si nécessaire)
if [ "$DEPLOY_DASH" = true ]; then
    log "🎨 Déploiement du dashboard..."
    cd "$APP_DASH_DIR"

    # Backup .env
    if [ -f ".env" ]; then
        cp .env .env.backup
        log "💾 Backup .env dashboard créé"
    fi

    # Copier les fichiers depuis le repo dashboard
    rsync -av --delete \
        --exclude 'node_modules' \
        --exclude '.env' \
        --exclude '.next' \
        --exclude '.git' \
        "$REPO_DASH_DIR/" "$APP_DASH_DIR/"

    # Restaurer .env
    if [ -f ".env.backup" ]; then
        mv .env.backup .env
    fi

    # Install dependencies
    log "📦 Installation des dépendances dashboard..."
    npm ci --only=production

    # Build Next.js
    log "🔨 Build Next.js dashboard..."
    npm run build
    
    log "✅ Dashboard déployé avec succès"
else
    log "⏭️  Skip déploiement dashboard (pas de [deploy])"
fi

# 6. Redémarrer les services
log "🔄 Redémarrage des services..."

# Note: Sur AlwaysData, tu dois adapter ces commandes selon leur interface
# Option 1: Via leur CLI/API
# Option 2: Via fichier de contrôle
# Option 3: Kill process + let systemd restart

# Exemple avec kill (à adapter selon ton setup AlwaysData)
# BOT_PID=$(cat /home/$USER/apps/7k-bot/bot.pid 2>/dev/null || echo "")
# if [ -n "$BOT_PID" ]; then
#     kill -SIGTERM "$BOT_PID" || true
#     log "✅ Bot redémarré (PID: $BOT_PID)"
# fi

log "=========================================="
log "✅ Déploiement terminé avec succès!"
log "   Bot commit: $BOT_COMMIT_HASH"
log "   Dashboard commit: $DASH_COMMIT_HASH"
log "   Bot: $APP_BOT_DIR"
log "   Dashboard: $APP_DASH_DIR"
log "=========================================="

# Envoyer une notification Discord (optionnel)
if [ -n "$DEPLOY_WEBHOOK_URL" ]; then
    NOTIF_MSG="✅ Déploiement réussi!"
    if [ "$DEPLOY_BOT" = true ]; then
        NOTIF_MSG="$NOTIF_MSG\n**Bot:** \`$BOT_COMMIT_HASH\` - $BOT_COMMIT_MSG"
    fi
    if [ "$DEPLOY_DASH" = true ]; then
        NOTIF_MSG="$NOTIF_MSG\n**Dashboard:** \`$DASH_COMMIT_HASH\` - $DASH_COMMIT_MSG"
    fi
    
    curl -X POST "$DEPLOY_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"content\":\"$NOTIF_MSG\"}"
fi

exit 0
