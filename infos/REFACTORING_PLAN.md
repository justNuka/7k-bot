# Plan de Refactoring - 7K Bot

**Date** : 31 Octobre 2025  
**Objectif** : Améliorer la maintenabilité, lisibilité et organisation du code

---

## 🎯 Objectifs principaux

1. **Simplifier `src/index.ts`** (actuellement 237 lignes, trop dense)
2. **Supprimer fichiers/code inutilisés**
3. **Améliorer la structure des modules**
4. **Standardiser les patterns** (commandes, handlers, utils)
5. **Améliorer la documentation inline**

---

## 📋 Phase 1 : Nettoyage `index.ts`

### Problèmes actuels :
- **42 imports** en début de fichier (trop verbeux)
- Logique d'autocomplete inline (bannière, signalement) → à déplacer dans modules de commande
- Map de commandes manuelle → peut être automatisée
- Handlers de boutons mélangés avec logique principale

### Actions :

#### 1.1 Créer `src/core/commandLoader.ts`
```typescript
// Charge automatiquement toutes les commandes depuis src/commands/
export function loadCommands(): Map<string, CommandModule> {
  // Scan du dossier, import dynamique, construction de la Map
}
```

#### 1.2 Créer `src/core/interactionRouter.ts`
```typescript
// Centralise le routing des interactions (slash, autocomplete, boutons)
export function routeInteraction(interaction: Interaction, commandMap: Map) {
  if (interaction.isChatInputCommand()) return handleSlashCommand(...)
  if (interaction.isAutocomplete()) return handleAutocomplete(...)
  if (interaction.isButton()) return handleButtonClick(...)
}
```

#### 1.3 Déplacer logique autocomplete
- `banniere` autocomplete → déjà dans `banniere.ts` ✅
- `signalement` autocomplete → créer fonction `autocomplete()` dans `signalement.ts`
- `absence` autocomplete → déjà dans `absence.ts` ✅

#### 1.4 Créer `src/core/buttonRouter.ts`
```typescript
// Centralise tous les handlers de boutons par préfixe
const buttonHandlers = {
  'notif:': handleNotifButton,
  'cand:': handleCandidaturesButton,
  'cr:': handleCrButtons,
  // etc.
}
```

### Résultat attendu :
`index.ts` réduit à ~100 lignes, logique déléguée à des modules dédiés

---

## 📋 Phase 2 : Fichiers inutilisés à supprimer

### À vérifier :
- `src/utils/storage.ts` : fonctions `readJson/writeJson` encore utilisées ?
  - Vérifier usage dans index.ts (ligne 57)
  - Si plus utilisé → supprimer
- `src/data/crCounters.json`, `src/data/crWeek.json` : remplacés par SQLite ?
  - Vérifier si migrations DB couvrent ces données
  - Si oui → supprimer fichiers JSON
- Anciens scripts dans `src/scripts/` :
  - `clear-global.ts` : utile ?
  - `inspect-commands.ts` : utile ?
  - `json2db.ts` : migration faite ? Garder pour historique ou supprimer

### Actions :
1. Audit complet des fichiers `/data/*.json`
2. Vérifier références dans codebase (`grep_search`)
3. Supprimer ou archiver dans `/infos/archives/`

---

## 📋 Phase 3 : Standardisation des commandes

### Pattern actuel (✅ bon) :
```typescript
export const data = new SlashCommandBuilder()...
export async function execute(interaction) {...}
export async function autocomplete(interaction) {...} // optionnel
export default { data, execute, autocomplete };
```

### À vérifier :
- Toutes les commandes suivent ce pattern ?
- `diag.ts` : `import diag, * as diagCmg` → incohérent avec autres imports

### Actions :
1. Standardiser tous les exports (`export default { data, execute, autocomplete }`)
2. Renommer imports dans `index.ts` : `diagCmg` → `diagCmd`
3. Ajouter JSDoc sur fonctions `execute()` et `autocomplete()`

---

## 📋 Phase 4 : Amélioration handlers

### Créer structure claire :
```
src/handlers/
  buttons/
    notifButtons.ts
    candidaturesButtons.ts
    crButtons.ts
  events/
    memberWelcome.ts
    candidatureWatcher.ts
```

### Actions :
1. Déplacer handlers de boutons dans `/handlers/buttons/`
2. Créer index.ts dans chaque sous-dossier pour re-export
3. Simplifier imports dans `index.ts` principal

---

## 📋 Phase 5 : Documentation et types

### Créer `src/types/index.ts`
```typescript
export interface CommandModule {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export interface ButtonHandler {
  prefix: string;
  handle: (interaction: ButtonInteraction) => Promise<void>;
}
```

### Actions :
1. Créer fichier de types centralisé
2. Typer `commandMap` et `buttonHandlers`
3. Ajouter JSDoc sur fonctions publiques principales

---

## 📋 Phase 6 : Utils refactoring

### Fichiers à revoir :
- `src/utils/cr.ts` : fonctions encore utilisées ? (crCounters.json migration)
- `src/utils/week.ts` : cohérent avec nouvelle DB ?
- `src/utils/storage.ts` : supprimer si JSON abandonnés

### Actions :
1. Audit de chaque util
2. Supprimer fonctions obsolètes
3. Regrouper utils similaires (ex: `dateParser.ts` + `time.ts` → `/utils/dates/`)

---

## 📋 Phase 7 : Tests

### Ajouter tests pour :
- `src/core/commandLoader.ts`
- `src/core/interactionRouter.ts`
- `src/utils/dateParser.ts` (déjà partiellement testé)

### Actions :
1. Créer `src/__tests__/core/` pour les nouveaux modules
2. Ajouter tests unitaires pour chaque fonction publique
3. Target : >70% coverage sur code core

---

## 🚀 Ordre d'exécution

1. ✅ **Phase 1.3** : Déplacer autocomplete signalement
2. ✅ **Phase 2** : Audit et suppression fichiers inutilisés
3. ✅ **Phase 1.1** : Créer `commandLoader.ts`
4. ✅ **Phase 1.2** : Créer `interactionRouter.ts`
5. ✅ **Phase 1.4** : Créer `buttonRouter.ts`
6. ✅ **Phase 1** : Refactorer `index.ts` (utiliser nouveaux modules)
7. ✅ **Phase 3** : Standardiser exports commandes
8. ✅ **Phase 4** : Réorganiser handlers
9. ✅ **Phase 5** : Ajouter types et JSDoc
10. ✅ **Phase 6** : Nettoyer utils
11. ✅ **Phase 7** : Ajouter tests

---

## ⚠️ Précautions

- **NE PAS TOUCHER** : `src/jobs/scrapeNetmarble.ts` et `src/scrapers/netmarble.ts` (non fonctionnel, à traiter séparément)
- **Garder compatibilité** : s'assurer que dashboard continue de fonctionner (API HTTP inchangée)
- **Tests après chaque phase** : `npm run prod` doit démarrer sans erreur
- **Commits atomiques** : un commit par phase pour rollback facile si besoin

---

## 📊 Métriques avant/après

### Avant :
- `index.ts` : 237 lignes
- Imports : 42
- Fichiers `/data/*.json` : 2-3 fichiers
- Coverage tests : ~15% (4 tests)

### Après (cible) :
- `index.ts` : <120 lignes
- Imports : <15 (grâce à modules core)
- Fichiers JSON obsolètes : 0
- Coverage tests : >60%
- Structure claire : `core/`, `handlers/buttons/`, `handlers/events/`

---

## 📝 Notes

- Ce plan est itératif : ajuster selon découvertes pendant refactoring
- Documenter chaque décision dans commits
- Créer PR/branch `refactor/index-cleanup` pour review avant merge
