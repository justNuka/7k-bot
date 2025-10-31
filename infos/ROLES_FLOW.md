# ✅ Flux complet des rôles pour les candidatures

## Flux de rôles implémenté

### 1️⃣ Arrivée sur le serveur → VISITEURS
**Handler** : `src/handlers/memberWelcome.ts`
```
Utilisateur rejoint le serveur
    ↓
✅ Rôle VISITEURS ajouté automatiquement
```

### 2️⃣ Publication candidature → VISITEURS → RECRUES
**Handler** : `src/handlers/candidatureWatcher.ts`
```
Utilisateur poste dans #candidatures
    ↓
❌ Rôle VISITEURS retiré
    ↓
✅ Rôle RECRUES ajouté
    ↓
Notification aux Officiers
```

### 3️⃣ Acceptation candidature → RECRUES → MEMBRES
**Handler** : `src/commands/candidatures.ts` (bouton ✅)
```
Officier clique sur ✅
    ↓
❌ Rôle RECRUES retiré
    ↓
✅ Rôle MEMBRES ajouté
    ↓
DM envoyé : "Ta candidature a été acceptée ! Bienvenue !"
```

### 4️⃣ Refus candidature → RECRUES → VISITEURS
**Handler** : `src/commands/candidatures.ts` (bouton ❌)
```
Officier clique sur ❌
    ↓
❌ Rôle RECRUES retiré
    ↓
✅ Rôle VISITEURS ajouté (retour à la case départ)
    ↓
DM envoyé : "Ta candidature a été refusée. Merci pour l'intérêt porté à la guilde."
```

---

## Tableau récapitulatif

| Étape | Action | Avant | Après |
|-------|--------|-------|-------|
| Arrivée | Rejoint le serveur | ∅ | VISITEURS |
| Candidature | Poste dans #candidatures | VISITEURS | RECRUES |
| Acceptée | Officier ✅ | RECRUES | MEMBRES |
| Refusée | Officier ❌ | RECRUES | VISITEURS |

---

## Sécurité & gestion d'erreurs

✅ **Vérification permissions** : Le bot vérifie qu'il a `ManageRoles`
✅ **Vérification hiérarchie** : Le bot vérifie que son rôle est au-dessus des rôles à gérer
✅ **Logs détaillés** : Chaque action de roleswap est loggée avec son résultat
✅ **Notifications** : 
  - Messages dans #retours-bot pour les officiers
  - DM envoyé à l'utilisateur (acceptation/refus)
  - Note sur le roleswap dans le log (✅ effectué / ⚠️ échec)

---

## Messages de feedback

### Candidature reçue (notification officiers)
```
📬 Nouvelle candidature
@User a posté dans #candidatures — ✅ Roleswap VISITEURS → RECRUES effectué
```

### Acceptation (log officiers)
```
✅ Acceptée par @Officier — candidature C-494 de @User — [lien] — ✅ Roleswap RECRUES → MEMBRES effectué
```

### Refus (log officiers)
```
❌ Refusée par @Officier — candidature C-494 de @User — [lien] — ✅ Roleswap RECRUES → VISITEURS effectué
```

---

## Points d'attention

⚠️ **Si l'utilisateur quitte le serveur** pendant qu'il est RECRUES :
- Il perd tous ses rôles (comportement Discord normal)
- S'il revient, il reçoit VISITEURS (cycle recommence)

⚠️ **Si un utilisateur est déjà RECRUES** et poste à nouveau :
- Le cooldown (60s) empêche le spam
- La vérification "1 seule candidature ouverte par user" empêche les doublons
- Message dans le code : `roleNote = ' — ℹ️ A déjà le rôle RECRUES'`

⚠️ **Si permissions/hiérarchie insuffisantes** :
- Le roleswap échoue mais la candidature est quand même enregistrée
- Log avec `⚠️ perms/hiérarchie rôles insuffisantes`
- Les officiers sont avertis dans la notification

---

## Tests recommandés

### Test 1 : Nouveau membre
1. Créer un compte test
2. Rejoindre le serveur
3. ✅ Vérifier que VISITEURS est ajouté

### Test 2 : Publication candidature
1. Avec le compte test (VISITEURS)
2. Poster dans #candidatures
3. ✅ Vérifier que VISITEURS est retiré
4. ✅ Vérifier que RECRUES est ajouté
5. ✅ Vérifier notification dans #retours-bot

### Test 3 : Acceptation
1. Avec un officier, lancer `/candidatures list`
2. Cliquer sur ✅ pour la candidature test
3. ✅ Vérifier que RECRUES est retiré
4. ✅ Vérifier que MEMBRES est ajouté
5. ✅ Vérifier DM reçu par le test user
6. ✅ Vérifier log dans #retours-bot

### Test 4 : Refus
1. Créer une nouvelle candidature test
2. Cliquer sur ❌
3. ✅ Vérifier que RECRUES est retiré
4. ✅ Vérifier que VISITEURS est rajouté
5. ✅ Vérifier DM reçu
6. ✅ Vérifier log dans #retours-bot

---

## Configuration requise (.env)

```env
ROLE_VISITEURS_ID=123456789    # Rôle donné à l'arrivée
ROLE_RECRUES_ID=987654321      # Rôle donné à la candidature
ROLE_MEMBRES_ID=456789123      # Rôle donné à l'acceptation
ROLE_OFFICIERS_ID=741852963    # Rôle pour gérer les candidatures
```

Tous ces rôles doivent être **en dessous du rôle du bot** dans la hiérarchie Discord pour que le bot puisse les gérer !
