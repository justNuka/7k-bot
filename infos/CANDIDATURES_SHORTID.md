# ✅ Améliorations affichage candidatures

## Modifications apportées

### 1. IDs lisibles au lieu des longs IDs Discord

**Avant** : `#1433764806569234494`
**Après** : `C-494` (3 derniers chiffres)

- Fonction `shortId()` pour générer des IDs courts
- Format: `C-XXX` (plus facile à lire et communiquer)
- Utilisé partout: embed, boutons, logs, DMs

### 2. Message public au lieu d'éphémère

**Avant** : Le message `/candidatures list` était visible uniquement par l'officier qui l'a lancé
**Après** : Le message reste visible par tous dans le salon (mais seuls les officiers peuvent lancer la commande et utiliser les boutons)

**Changement technique** :
```typescript
// Avant
await officerDefer(interaction);
await officerEdit(interaction, ...);

// Après
await interaction.deferReply({ ephemeral: false });
await interaction.editReply(...);
```

---

## Exemple visuel avec les nouveaux IDs

```
📋 Candidatures ouvertes
3 candidatures en attente

C-494 📎
@Harachi · 31 octobre 2025 11:29 · 📄 Voir
[✅ C-494] [❌ C-494]

C-257
@Nuka-v2 · 23 octobre 2025 00:43 · 📄 Voir
[✅ C-257] [❌ C-257]

C-2
@Ace · 20 octobre 2025 15:40 · 📄 Voir
[✅ C-2] [❌ C-2]

Page 1/1
```

---

## Avantages

✅ **Plus lisible** : C-494 vs 1433764806569234494
✅ **Plus facile à communiquer** : "Accepte la C-494" vs "Accepte la 1433764806569234494"
✅ **Persistant** : Le message reste visible pour coordination entre officiers
✅ **Cohérent** : Même ID court utilisé partout (boutons, logs, DMs, notifications)

---

## Notes techniques

- Le `shortId()` prend les **3 derniers chiffres** de l'ID Discord
- Suffisamment unique pour une petite liste de candidatures ouvertes
- Si collision (très rare), l'ID complet reste stocké en DB pour référence unique
- Les boutons utilisent toujours l'ID complet en interne (`customId`)

---

## Test à faire

1. Lancer `/candidatures list`
2. Vérifier que les IDs sont au format `C-XXX`
3. Vérifier que le message reste visible (pas éphémère)
4. Cliquer sur ✅ ou ❌ et vérifier les logs/DMs utilisent aussi le shortId
