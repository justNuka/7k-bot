# Script de lancement du bot en dev avec encodage UTF-8
# Usage: .\dev-utf8.ps1

# Forcer l'encodage UTF-8 pour la console
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "✅ Encodage UTF-8 activé" -ForegroundColor Green
Write-Host "🚀 Lancement du bot en mode développement..." -ForegroundColor Cyan

# Lancer le bot
npm run register:prod ; npm run prod
