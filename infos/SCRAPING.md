# Scraping Netmarble Forums

## 📋 Vue d'ensemble

Le bot surveille automatiquement les forums officiels de **Seven Knights Re:BIRTH** pour détecter les nouveaux posts et envoyer des notifications Discord.

## 🎯 Catégories surveillées

| Catégorie | Emoji | Couleur | Board ID |
|-----------|-------|---------|----------|
| **Notices** | 📢 | Bleu Discord | 10 |
| **Updates** | 🔄 | Vert | 11 |
| **Known Issues** | ⚠️ | Jaune | 12 |
| **Developer Notes** | 💬 | Rose | 13 |

## 🔧 Fonctionnement

### Méthode de détection

Le scraper utilise une approche **simple et efficace** :

1. **Test d'existence** : Pour chaque catégorie, on teste les 30 IDs suivant le dernier ID connu
2. **Requête HTTP HEAD** : On vérifie si l'URL répond (HTTP 200 = article existe)
3. **Comparaison** : On compare avec les IDs déjà vus (stockés dans `scraped_seen.json`)
4. **Notification** : Pour chaque nouvel ID, on envoie un embed Discord stylisé

### IDs de départ

Les IDs de référence (mis à jour périodiquement) :

```typescript
const KNOWN_LATEST_IDS = {
  notices: 532,
  updates: 996,
  known: 1012,
  devnotes: 975,
};
```

## 📨 Format des notifications

Chaque nouveau post génère un embed Discord avec :

- **Titre** : Emoji + Catégorie + "Nouveau post"
- **Description** : Message d'information avec lien vers l'article
- **Couleur** : Couleur spécifique à la catégorie
- **Footer** : Catégorie + "Seven Knights Re:BIRTH"
- **Timestamp** : Date/heure de détection

### Exemple de notification

```
📢 Notice — Nouveau post

Un nouveau post a été publié dans la catégorie Notice.

📖 Lire l'article complet
https://forum.netmarble.com/sk_rebirth_gl/view/10/542

Catégorie: Notice • Seven Knights Re:BIRTH
Aujourd'hui à 22:45
```

## ⚙️ Configuration

### Variables d'environnement

```env
# Canal Discord pour les notifications
INFOS_ANNONCES_JEU_CHANNEL_ID=1415367922242687036

# Fréquence de scraping (cron)
SCRAPE_CRON="0 * * * *"  # Toutes les heures (défaut)

# Timezone pour le cron
RESET_CRON_TZ="Europe/Paris"
```

### Fréquence recommandée

- **Production** : `0 * * * *` (toutes les heures - défaut)
- **Test** : `*/5 * * * *` (toutes les 5 minutes)
- **Surveillance accrue** : `*/30 * * * *` (toutes les 30 minutes)

## 🎮 Commandes

### `/scrape list`

Affiche les derniers articles d'une catégorie.

```
/scrape list cat:notices
```

**Réponse** : Embed avec les 5 derniers articles et leurs URLs.

## 📂 Fichiers clés

| Fichier | Description |
|---------|-------------|
| `src/scrapers/netmarble.ts` | Logique de scraping (test HEAD) |
| `src/jobs/scrapeNetmarble.ts` | Job cron + notifications Discord |
| `src/commands/scrape.ts` | Commande `/scrape` pour tests manuels |
| `src/data/scraped_seen.json` | Cache des IDs déjà vus |

## 🔄 Flux de données

```
┌─────────────────┐
│   Cron Job      │  Toutes les heures
│  (scrapeNetmarble)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  fetchCategoryList()
│  • Test HTTP HEAD
│  • Détecte nouveaux IDs
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Compare avec    │
│  scraped_seen.json
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Envoie embeds   │  Canal #infos-annonces-jeu
│  Discord         │
└─────────────────┘
```

## 🐛 Dépannage

### Aucune notification reçue

1. Vérifier que `INFOS_ANNONCES_JEU_CHANNEL_ID` est configuré
2. Vérifier les logs : `[ScrapeNetmarble] Aucun nouveau post Netmarble`
3. Tester manuellement : `/scrape list cat:notices`

### Trop de notifications

1. Vérifier `scraped_seen.json` — peut-être que le cache a été vidé
2. Ajuster `SCRAPE_CRON` pour réduire la fréquence

### Articles manqués

1. Augmenter `range` dans `fetchCategoryList()` (actuellement 30)
2. Mettre à jour `KNOWN_LATEST_IDS` si les IDs ont beaucoup augmenté

## 🚀 Améliorations futures

### Phase 2 : Extraction de contenu

- Parser le HTML pour extraire titre + résumé
- Afficher un extrait dans la description de l'embed
- Traduire automatiquement (API)

### Phase 3 : Résumé IA

- Utiliser une IA (GPT/Claude) pour générer un résumé
- Ajouter un bouton "Voir le résumé IA"
- Stocker les résumés en cache

## 📝 Notes techniques

### Pourquoi HTTP HEAD ?

- Plus rapide que GET (pas de download du body)
- Réduit la charge sur les serveurs Netmarble
- Suffisant pour détecter l'existence d'un article

### Pourquoi pas d'API officielle ?

L'API REST de Netmarble (`/api/board/...`) :
- Retourne du HTML au lieu de JSON
- Nécessite probablement une session/cookies
- Pas documentée publiquement

Notre solution (test HEAD) est plus simple et robuste.

### Rate limiting

- Pause de 150ms entre chaque requête HEAD
- Maximum 30 articles testés par catégorie
- Total : ~120 requêtes par scrape (4 catégories × 30)
- Durée totale : ~18 secondes par scrape

## 📊 Statistiques

- **Fréquence** : Toutes les 6h = 4 fois/jour
- **Requêtes/jour** : ~480 requêtes HEAD
- **Charge** : Très faible, négligeable pour Netmarble

---

**Dernière mise à jour** : 31 octobre 2025
