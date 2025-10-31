# Guide de démarrage rapide - Tests

## Installation

Installer Vitest et les dépendances de test :

```bash
cd 7k-bot
npm install
```

## Lancer les tests

```bash
# Lancer tous les tests (une fois)
npm test

# Mode watch (relance auto quand tu modifies un fichier)
npm run test:watch

# Avec rapport de couverture (coverage)
npm run test:coverage
```

## Structure actuelle

```
src/
  __tests__/
    setup.ts                    # Config globale
    mocks/
      discord.ts                # Mocks Discord.js (Interaction, Client, etc.)
    commands/
      help.test.ts              # Exemple : tests pour /help
```

## Prochain test à écrire

Essaie de tester une commande simple comme `/banniere list` :
- Mock l'interaction
- Mock la DB avec quelques bannières
- Vérifier que l'embed contient les bonnes infos

Voir `TESTING.md` pour plus de détails et bonnes pratiques.

## Notes importantes

- Les tests utilisent des **mocks** : Discord n'est pas contacté, la DB est en mémoire
- Parfait pour tester la logique métier, pas pour tester l'intégration Discord réelle
- Si tu veux tester avec un vrai bot : crée un serveur Discord de test et utilise un token de dev
