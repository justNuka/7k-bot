#!/bin/bash
# Script de déploiement pour artefacts pré-compilés (via GitHub Actions)
# Plus besoin de npm install/build sur AlwaysData !

set -euo pipefail

# Configuration
APP_BOT="$HOME/apps/7k-bot"
APP_DASH="$HOME/apps/7k-bot-dashboard"
LOG_FILE="$HOME/logs/deploy.log"

# Fonction de logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=========================================="
log "🚀 Deploying pre-built artifacts from CI"
log "=========================================="

# ========================================
# BOT DEPLOYMENT
# ========================================
if [ -f "$HOME/bot-artifacts.tar.gz" ]; then
    log "🤖 Deploying bot artifacts..."
    
    mkdir -p "$APP_BOT"
    
    # Backup .env if exists
    if [ -f "$APP_BOT/.env" ]; then
        cp "$APP_BOT/.env" "$APP_BOT/.env.bak"
        log "💾 Backed up bot .env"
    fi
    
    # Extract artifacts
    tar -xzf "$HOME/bot-artifacts.tar.gz" -C "$APP_BOT"
    rm -f "$HOME/bot-artifacts.tar.gz"
    
    # Restore .env
    if [ -f "$APP_BOT/.env.bak" ]; then
        mv "$APP_BOT/.env.bak" "$APP_BOT/.env"
        log "✅ Restored bot .env"
    fi
    
    # Verify dist/ exists
    if [ ! -d "$APP_BOT/dist" ]; then
        log "❌ ERROR: dist/ not found in bot artifacts!"
        exit 1
    fi
    
    log "✅ Bot deployed successfully"
else
    log "⏭️  No bot artifacts to deploy"
fi

# ========================================
# DASHBOARD DEPLOYMENT
# ========================================
if [ -f "$HOME/dashboard-artifacts.tar.gz" ]; then
    log "🎨 Deploying dashboard artifacts..."
    
    mkdir -p "$APP_DASH"
    
    # Backup .env if exists
    if [ -f "$APP_DASH/.env" ]; then
        cp "$APP_DASH/.env" "$APP_DASH/.env.bak"
        log "💾 Backed up dashboard .env"
    fi
    
    # Extract artifacts
    tar -xzf "$HOME/dashboard-artifacts.tar.gz" -C "$APP_DASH"
    rm -f "$HOME/dashboard-artifacts.tar.gz"
    
    # Restore .env
    if [ -f "$APP_DASH/.env.bak" ]; then
        mv "$APP_DASH/.env.bak" "$APP_DASH/.env"
        log "✅ Restored dashboard .env"
    fi
    
    # Verify standalone/ exists
    if [ ! -d "$APP_DASH/.next/standalone" ]; then
        log "❌ ERROR: .next/standalone/ not found in dashboard artifacts!"
        exit 1
    fi
    
    # Copy public/ and .next/static to standalone directory (required by Next.js)
    if [ -d "$APP_DASH/public" ]; then
        cp -r "$APP_DASH/public" "$APP_DASH/.next/standalone/" || true
    fi
    
    if [ -d "$APP_DASH/.next/static" ]; then
        mkdir -p "$APP_DASH/.next/standalone/.next"
        cp -r "$APP_DASH/.next/static" "$APP_DASH/.next/standalone/.next/" || true
    fi
    
    log "✅ Dashboard deployed successfully"
else
    log "⏭️  No dashboard artifacts to deploy"
fi

# ========================================
# RESTART SERVICES (TODO: use AlwaysData API)
# ========================================
log "ℹ️  Restart apps via AlwaysData UI or API"
log "   Bot: $APP_BOT/dist/index.js"
log "   Dashboard: $APP_DASH/.next/standalone/server.js"

log "=========================================="
log "✅ Deployment complete!"
log "=========================================="

exit 0
