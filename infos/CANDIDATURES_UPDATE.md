# ✅ Modifications système de candidatures

## Modifications effectuées

### 1. Watcher de candidatures (`src/handlers/candidatureWatcher.ts`)

**✅ Ajout automatique du rôle RECRUES**

Lorsqu'un utilisateur poste une candidature :
- Le bot vérifie si l'utilisateur a déjà le rôle RECRUES
- Si non, le bot ajoute automatiquement le rôle RECRUES
- Gestion des erreurs (permissions, hiérarchie des rôles)
- Log de l'opération dans la notification aux officiers

**Messages de feedback** :
- ✅ Rôle RECRUES ajouté
- ℹ️ A déjà le rôle RECRUES
- ⚠️ Impossible d'ajouter le rôle (permissions/hiérarchie)

---

### 2. Affichage des candidatures (`src/commands/candidatures.ts`)

**✅ Nouveau format d'affichage**

Avant :
- Une candidature par page
- Navigation entre les candidatures (Précédent/Suivant)
- Boutons Accepter/Refuser en bas

Après :
- **Plusieurs candidatures (jusqu'à 5) par page dans un seul embed**
- Chaque candidature affichée comme un field avec :
  - ID de la candidature
  - Icône 📎 si pièces jointes
  - Mention de l'utilisateur
  - Date/heure de création
  - Lien vers le message
- **Boutons Accepter/Refuser à côté de chaque candidature**
  - Format compact : `✅ #ID` et `❌ #ID`
  - Une rangée de boutons par candidature
- **Pagination en bas** (si plus de 5 candidatures)
  - Boutons "⬅️ Page précédente" et "Page suivante ➡️"
  - Désactivés intelligemment (première/dernière page)

---

## Comportement complet du système

### 📬 Réception d'une candidature

1. Un utilisateur poste dans #candidatures
2. ✅ Le bot ajoute automatiquement le rôle RECRUES
3. La candidature est enregistrée en DB (status: 'open')
4. Les Officiers sont notifiés dans #retours-bot avec :
   - Embed avec infos candidature
   - Note sur l'ajout du rôle
   - Lien vers le message
   - Aperçu du contenu (400 premiers caractères)

### 📋 Consultation des candidatures

1. Un Officier tape `/candidatures list`
2. Le bot affiche un embed avec toutes les candidatures ouvertes (max 5 par page)
3. Chaque candidature a ses propres boutons ✅/❌
4. Navigation par pages si nécessaire

### ✅ Acceptation d'une candidature

1. Officier clique sur `✅ #ID`
2. Le bot :
   - Met à jour le status en DB ('accepted')
   - ✅ Ajoute le rôle MEMBRES (si pas déjà)
   - ❌ Retire le rôle RECRUES (si présent)
   - Envoie un DM à l'utilisateur (si possible)
   - Log dans #retours-bot
   - Rafraîchit automatiquement la liste

### ❌ Refus d'une candidature

1. Officier clique sur `❌ #ID`
2. Le bot :
   - Met à jour le status en DB ('rejected')
   - Envoie un DM à l'utilisateur (si possible)
   - Log dans #retours-bot
   - Rafraîchit automatiquement la liste

---

## Sécurité & permissions

- ✅ Commande réservée aux Officiers (vérification rôle)
- ✅ Boutons réservés aux Officiers (double vérification)
- ✅ Gestion des permissions manquantes (ManageRoles)
- ✅ Gestion de la hiérarchie des rôles
- ✅ Logs de toutes les actions (audit trail)
- ✅ Cooldown anti-spam (60s entre deux candidatures)
- ✅ Une seule candidature ouverte par utilisateur

---

## Exemple visuel

```
📋 Candidatures ouvertes
5 candidatures en attente

#1234567890123456 📎
@User1 · 12 janv. 2025 à 14:30 · 📄 Voir
[✅ #1234567890123456] [❌ #1234567890123456]

#9876543210987654
@User2 · 12 janv. 2025 à 15:45 · 📄 Voir
[✅ #9876543210987654] [❌ #9876543210987654]

...

[⬅️ Page précédente] [Page suivante ➡️]

Page 1/2
```

---

## Test recommandés

1. **Test ajout rôle RECRUES** :
   - Créer un compte test sans rôle
   - Poster une candidature
   - Vérifier que le rôle RECRUES est ajouté

2. **Test affichage multiple** :
   - Créer 7-8 candidatures
   - Vérifier pagination (2 pages)
   - Vérifier tous les boutons

3. **Test acceptation** :
   - Accepter une candidature
   - Vérifier roleswap (RECRUES → MEMBRES)
   - Vérifier DM envoyé
   - Vérifier log dans #retours-bot

4. **Test refus** :
   - Refuser une candidature
   - Vérifier DM envoyé
   - Vérifier log dans #retours-bot

5. **Test permissions** :
   - Essayer avec un utilisateur non-Officier
   - Vérifier refus d'accès
