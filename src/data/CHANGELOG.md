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
 
## Unreleased — Refactor & amélioration (Oct 31, 2025)

### 🔨 Refactor
- Démarrage du refactoring du point d'entrée `src/index.ts` : délégation au chargeur de commandes et routeur d'interactions (`src/core/commandLoader.ts`, `src/core/interactionRouter.ts`, `src/core/buttonRouter.ts`).
- Ajout de types partagés dans `src/types/index.ts` pour standardiser les modules de commande et handlers de boutons.
- Réorganisation : extraction du routing des interactions et centralisation des handlers de boutons.

### ✨ Améliorations UX & commandes
- Ajour des autocompletes pour les dates et amélioration des messages `/help`.
- Déplacement de l'autocomplete du module `signalement` dans `signalement.ts`.

### 🧰 Divers
- Nettoyage initial : suppression de `src/utils/candidatures.ts` (migré vers DB).
- Ajout de documentation de refactorisation dans `infos/REFACTORING_PLAN.md`.

