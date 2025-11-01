# 🪝 Git Hooks - Build Automatique

Ce projet utilise **Husky** pour automatiser le build avant chaque push.

## Comment ça marche ?

Quand tu fais `git push`, le hook `pre-push` :

1. 🔨 **Build automatiquement** le projet (`npm run build`)
2. 📦 **Ajoute `dist/`** au dernier commit (si changements)
3. ✅ **Laisse passer le push** si le build réussit
4. ❌ **Annule le push** si le build échoue

## Workflow de développement

```bash
# 1. Développe normalement
# 2. Commit tes changements
git add .
git commit -m "feat: nouvelle fonctionnalité"

# 3. Push (le build se fait automatiquement)
git push origin main
```

**Plus besoin de faire `npm run build` manuellement !** 🎉

## Détails techniques

- **Hook installé** : `.husky/pre-push`
- **Script Husky** : Configuré via `npm run prepare` (automatique après `npm install`)
- **Commit amend** : Le hook fait `git commit --amend --no-verify` pour ajouter `dist/` au dernier commit

## Bypass (si nécessaire)

Si tu veux pusher SANS build (déconseillé en production) :

```bash
git push --no-verify
```

⚠️ **Attention** : Le déploiement AlwaysData va échouer si `dist/` n'est pas présent !

## Désactivation temporaire

```bash
# Désactiver Husky
npm pkg set scripts.prepare=""

# Réactiver Husky
npm pkg set scripts.prepare="husky"
npm run prepare
```
