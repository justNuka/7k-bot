# Tests pour 7k-bot

## Stratégie de tests

Le bot utilise **Vitest** pour tester les commandes Discord sans avoir besoin d'un bot live ou d'un serveur Discord réel.

### Pourquoi Vitest ?

- ✅ Compatible TypeScript natif (pas besoin de transpilation)
- ✅ API similaire à Jest (familière)
- ✅ Exécution rapide avec ESM support
- ✅ Mocks intégrés puissants
- ✅ Watch mode pour dev

### Architecture des tests

```
src/
  commands/
    banniere.ts          # Commande à tester
  __tests__/
    commands/
      banniere.test.ts   # Tests de la commande
    setup.ts             # Configuration globale des tests
    mocks/
      discord.ts         # Mocks Discord.js (Interaction, Client, Guild, etc.)
      db.ts              # Mock ou DB SQLite en mémoire
```

## Types de tests

### 1. Tests unitaires des commandes (sans Discord live)

On mock l'objet `Interaction` de Discord.js pour simuler les interactions utilisateur.

**Exemple** : tester `/banniere add`
- Mock une interaction avec les options requises
- Vérifier que `insertBanner()` est appelé avec les bons params
- Vérifier que `interaction.editReply()` contient le bon message

### 2. Tests d'intégration DB

On utilise une DB SQLite **en mémoire** (`:memory:`) pour tester les fonctions `src/db/*.ts` sans toucher à la DB réelle.

**Exemple** : tester `insertBanner()` + `getBannerById()`
- Insérer une bannière
- Vérifier qu'on peut la récupérer
- Vérifier les champs

### 3. Tests de permissions

On mock les rôles/channels pour vérifier que `requireAccess()` fonctionne correctement.

**Exemple** : tester qu'un utilisateur sans le rôle Officier ne peut pas utiliser `/banniere`

## Commandes de test

```bash
# Lancer tous les tests
npm test

# Mode watch (relance auto si fichier change)
npm test -- --watch

# Coverage (génère un rapport de couverture)
npm test -- --coverage

# Tester un fichier spécifique
npm test banniere.test.ts
```

## Exemple concret : tester `/help`

La commande `/help` est simple et parfaite pour démarrer :
- Pas d'accès DB
- Pas de permissions complexes
- Retourne juste un embed

Voir `src/__tests__/commands/help.test.ts` pour l'implémentation.

## Limites des tests

### Ce qu'on PEUT tester sans Discord live

- ✅ Logique métier (parsing, validation, calculs)
- ✅ Accès DB (avec DB en mémoire)
- ✅ Construction des embeds/messages
- ✅ Vérification des permissions (avec mocks)
- ✅ Gestion des erreurs

### Ce qu'on NE PEUT PAS tester facilement

- ❌ Envoi réel de messages Discord (on mock `reply()`/`editReply()`)
- ❌ Réactions aux boutons/select menus (nécessiterait un bot live)
- ❌ Autocomplete en temps réel (on peut tester la logique mais pas l'UX)
- ❌ Intégrations externes (scraping Netmarble, YouTube) → à mocker

## Bonnes pratiques

1. **Isoler la logique métier** : extraire les fonctions "pures" des commandes pour les tester facilement
   - ❌ Tout dans `execute(interaction)`
   - ✅ `execute()` appelle `validateBannerInput(opts)`, `formatBannerEmbed(banner)`, etc.

2. **Utiliser une DB en mémoire** : ne jamais modifier `src/data/bot.db` pendant les tests
   ```ts
   const testDb = new Database(':memory:');
   ```

3. **Mocker les dépendances externes** :
   ```ts
   vi.mock('../utils/send.ts', () => ({
     sendToChannel: vi.fn()
   }));
   ```

4. **Tester les cas limites** :
   - Input invalide (date malformée, champs manquants)
   - Permissions insuffisantes
   - Erreurs DB (contrainte unique, etc.)

## Roadmap tests

- [x] Setup Vitest + mocks de base
- [ ] Tests `/help` (exemple simple)
- [ ] Tests `/banniere add/list/remove` (DB + permissions)
- [ ] Tests `/oubli-cr` (logique complexe)
- [ ] Tests handlers boutons (`notifButtons.ts`, `crButtons.ts`)
- [ ] CI/CD : lancer les tests automatiquement sur push/PR

## Ressources

- [Vitest docs](https://vitest.dev/)
- [Discord.js mocking guide](https://discordjs.guide/popular-topics/mocking.html)
- [Better-sqlite3 in-memory DB](https://github.com/WiseLibs/better-sqlite3/wiki/API#new-databasepath-options)
