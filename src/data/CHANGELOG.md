# Changelog du Bot

## Version 2.0 - Octobre 2025

### 🎯 Nouvelles fonctionnalités

#### Système de candidatures amélioré
- Affichage des candidatures avec IDs courts (format C-XXX)
- Messages publics au lieu d'éphémères
- Gestion automatique des rôles : VISITEURS → RECRUES → MEMBRES
- Messages d'acceptation/refus détaillés et accueillants en DM

#### Saisie de dates intuitive
- **Plus besoin du format YYYY-MM-DD !** 
- Formats acceptés :
  - Mots-clés : `aujourd'hui`, `demain`, `après-demain`
  - Jours : `lundi`, `mardi`, `mercredi`, etc. (prochain jour)
  - Relatif : `dans 3 jours`, `dans 2 semaines`
  - Date naturelle : `4 novembre`, `lundi 15 novembre`
  - Formats classiques : `15/11/2025`, `15-11-2025`, `15.11.2025`
- Autocomplete intelligent avec suggestions lors de la frappe
- Concerne les commandes : `/absence`, `/banniere`

### 🐛 Corrections
- Fix runtime error sur les interactions fakeSlash
- Fix TypeScript dans coaching.ts
- Amélioration de la gestion des erreurs

### 🔧 Technique
- Migration vers SQLite WAL mode
- Support SQLITE_PATH pour déploiement AlwaysData
- Framework de tests avec Vitest (4 tests passing)
- Scripts de déploiement ajoutés
 
## Unreleased — Refactor majeur & Optimisations (Oct 31, 2025)

### ⚡ Optimisations performance & qualité

#### Logger structuré (Pino)
- Migration complète : **~45 `console.log/error/warn` → logger structuré**
- Nouveau helper `createLogger(module)` pour contexte automatique
- Logs JSON en production, pretty-print en développement
- Contrôle du niveau via `LOG_LEVEL` env var (debug, info, warn, error)
- Métadonnées structurées pour meilleure traçabilité
- **Fichiers migrés** :
  - 5 jobs (ytWatch, scrapeNetmarble, notifs, crWeeklyReset, absences)
  - 3 handlers (candidatureWatcher, notifButtons, memberWelcome)
  - 20 commands (candidatures, banniere, absence, help, kick, yt, notif, ytroute, signalement, oubli-cr, low-score, changelog, coaching, diag, gdoc, helpadmin, infoserveur, notifpanel, pingoff, roleset, scrape)

#### Validation environnement
- Nouveau module `src/config/env.ts` avec validation au démarrage
- Interface TypeScript `BotEnvironment` pour accès type-safe
- Fail-fast : erreur claire si variables requises manquantes
- Fonctions : `validateEnv()`, `logEnvSummary()`
- Variables validées : `DISCORD_TOKEN`, `GUILD_ID` (requis), `DASH_PORT`, `LOG_LEVEL`, etc.

#### Health check amélioré
- Endpoint `/health` renforcé dans `src/http/server.ts`
- **4 checks critiques** :
  - Database : test `SELECT 1` (réactivité SQLite)
  - Discord : client ready, uptime, ping WebSocket, guilds
  - Memory : heap usage, heap total, RSS (en MB)
  - Process : uptime, version Node.js, plateforme
- Codes HTTP : `200 OK` (tous checks OK) ou `503 Service Unavailable` (DB/Discord down)
- Response structurée JSON avec status individuel par check

### 🔨 Refactor architecture
- **Core modules** : création de `src/core/` avec :
  - `commandLoader.ts` : chargement dynamique des commandes (plus d'imports manuels)
  - `interactionRouter.ts` : routing centralisé (slash commands, autocomplete, buttons)
  - `buttonRouter.ts` : dispatch des boutons par préfixe (notif:, cand:, cr:)
  - Types partagés dans `src/types/index.ts`
- **index.ts** : refactorisé de 237 à ~120 lignes, suppression de 42 imports explicites
- **Handlers** : réorganisation avec structure claire :
  - `src/handlers/buttons/` (notifButtons, crButtons)
  - `src/handlers/events/` (memberWelcome, candidatureWatcher)
- Tous les imports relatifs mis à jour pour refléter la nouvelle structure

### 🗑️ Cleanup
- Suppression de `src/utils/candidatures.ts` (migré vers `src/db/candidatures.ts`)
- Mise à jour de `helpadmin.ts` : affiche SQLite DB au lieu des anciens JSON (crCounters, crWeek)
- Autocomplete de `signalement` déplacé dans son module

### � Organisation utils (Phase 6)
- **Structure modulaire** : `src/utils/` réorganisé par catégorie :
  - `discord/` (send, reply, access, members)
  - `time/` (time, week, dateParser, cron)
  - `cr/` (cr, crReply)
  - `formatting/` (embed, officerReply)
- **Index.ts** dans chaque sous-dossier pour exports propres
- Tous les imports mis à jour automatiquement (80+ fichiers)

### 📖 Documentation JSDoc (Phase 5)
- **Types centraux** (`src/types/index.ts`) : documentation complète avec exemples
- **Core modules** : JSDoc détaillé sur `commandLoader`, `interactionRouter`, `buttonRouter`
- **Handlers** : documentation des fonctions principales (notifButtons, memberWelcome)
- Exemples d'utilisation dans les commentaires

### �🔧 Technique
- Fix type `InteractionReplyOptions` vs `InteractionEditReplyOptions` dans `src/utils/discord/reply.ts`
- Build TypeScript ✅ (0 erreurs)
- Tests Vitest ✅ (4/4 passing)

### 📚 Documentation
- Création de `infos/REFACTORING_PLAN.md` : roadmap complète en 7 phases
- Création de `infos/SESSION_2025-10-31-refactor.md` : récapitulatif session
- Mise à jour de `.github/copilot-instructions.md` avec nouvelle architecture

