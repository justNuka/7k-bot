# 7k-bot

Bot Discord pour la guilde Seven Knights 2.

## 🚀 Lancement rapide

### Développement

```bash
npm run dev
```

### Développement avec encodage UTF-8 (Windows)

Si les caractères accentués s'affichent mal dans les logs, utilisez :

```powershell
.\dev-utf8.ps1
```

Ou configurez manuellement l'encodage avant de lancer :

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
npm run dev
```

### Production

```bash
npm run build
npm run start
```

## 📝 Commandes disponibles

- `npm run dev` — Lance le bot en mode développement (TypeScript via tsx)
- `npm run build` — Compile le TypeScript vers JavaScript
- `npm run start` — Lance le bot compilé (production)
- `npm run prod` — Build + Start (production complète)
- `npm test` — Lance les tests Vitest
- `npm run register:dev` — Enregistre les commandes slash (développement)
- `npm run register:prod` — Enregistre les commandes slash (production)
- `npm run db:init` — Initialise la base de données SQLite
- `npm run db:explorer` — Ouvre l'explorateur de base de données

## 🔧 Configuration

Créez un fichier `.env` à la racine du projet :

```env
# Discord
DISCORD_TOKEN=your_bot_token_here
GUILD_ID=your_guild_id_here
ROLE_OFFICIERS_ID=your_role_id_here

# Dashboard API
DASH_API_KEY=your_secret_key_here
DASH_PORT=8787

# Logging
LOG_LEVEL=info
NODE_ENV=development

# Database (optionnel, défaut: ./data/bot.db)
SQLITE_PATH=/chemin/vers/bot.db
```

## 🏗️ Architecture

- **`src/index.ts`** — Point d'entrée principal
- **`src/core/`** — Modules centraux (commandLoader, interactionRouter, buttonRouter)
- **`src/commands/`** — Commandes slash Discord (21 modules)
- **`src/handlers/`** — Handlers d'événements et boutons Discord
- **`src/jobs/`** — Tâches planifiées (cron, scrapers, watchers)
- **`src/db/`** — Schéma et helpers base de données SQLite
- **`src/http/`** — Serveur API Fastify pour le dashboard
- **`src/utils/`** — Utilitaires réutilisables (logger, dateParser, etc.)

## 📊 Logger structuré

Le bot utilise Pino pour un logging structuré :

```typescript
import { createLogger } from './utils/logger.js';
const log = createLogger('MyModule');

log.info({ userId: '123' }, 'User action');
log.error({ error: e }, 'Something failed');
```

En développement : pretty-print colorisé  
En production : JSON structuré

## 🧪 Tests

```bash
npm test
```

Framework : Vitest  
Coverage : 4/4 tests passing

## 📦 Déploiement

Voir le fichier `infos/DEPLOYMENT.md` pour les instructions complètes.

## 📄 License

Projet privé — Seven Knights 2 Guild