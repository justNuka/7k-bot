/**
 * Gestion des articles Netmarble en base de données
 */
import { db } from './db.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('DB:Netmarble');
/**
 * Récupère tous les IDs déjà vus pour une catégorie
 */
export function getSeenIds(category) {
    const rows = db.prepare(`
    SELECT id FROM netmarble_articles
    WHERE category = ?
    ORDER BY id DESC
  `).all(category);
    return rows.map(r => r.id);
}
/**
 * Récupère le dernier ID connu pour une catégorie (le plus grand numériquement)
 */
export function getLastKnownId(category) {
    const row = db.prepare(`
    SELECT MAX(CAST(id AS INTEGER)) as max_id
    FROM netmarble_articles
    WHERE category = ?
  `).get(category);
    return row?.max_id || null;
}
/**
 * Vérifie si la synchronisation initiale est complète
 */
export function isInitialSyncDone() {
    const row = db.prepare(`
    SELECT value FROM netmarble_meta WHERE key = 'initial_sync_done'
  `).get();
    return row?.value === 'true';
}
/**
 * Marque la synchronisation initiale comme complète
 */
export function markInitialSyncDone() {
    db.prepare(`
    INSERT OR REPLACE INTO netmarble_meta (key, value)
    VALUES ('initial_sync_done', 'true')
  `).run();
    log.info('Synchronisation initiale Netmarble marquée comme complète');
}
/**
 * Récupère tous les IDs déjà vus pour toutes les catégories
 */
export function getAllSeenIds() {
    const rows = db.prepare(`
    SELECT category, id FROM netmarble_articles
    ORDER BY category, id DESC
  `).all();
    const result = {
        notices: [],
        updates: [],
        known: [],
        devnotes: []
    };
    for (const row of rows) {
        result[row.category].push(row.id);
    }
    return result;
}
/**
 * Vérifie si un article existe déjà
 */
export function isArticleSeen(category, id) {
    const row = db.prepare(`
    SELECT 1 FROM netmarble_articles
    WHERE category = ? AND id = ?
  `).get(category, id);
    return !!row;
}
/**
 * Ajoute un nouvel article
 */
export function addArticle(category, id, url) {
    try {
        db.prepare(`
      INSERT INTO netmarble_articles (category, id, url)
      VALUES (?, ?, ?)
    `).run(category, id, url);
        log.debug({ category, id }, 'Article ajouté en DB');
    }
    catch (e) {
        // Ignore les doublons (UNIQUE constraint)
        if (!e.message.includes('UNIQUE')) {
            log.error({ error: e, category, id }, 'Erreur ajout article');
            throw e;
        }
    }
}
/**
 * Ajoute plusieurs articles d'un coup (batch insert)
 */
export function addArticles(articles) {
    let added = 0;
    const insert = db.prepare(`
    INSERT OR IGNORE INTO netmarble_articles (category, id, url)
    VALUES (?, ?, ?)
  `);
    const transaction = db.transaction((items) => {
        for (const article of items) {
            const result = insert.run(article.category, article.id, article.url);
            if (result.changes > 0)
                added++;
        }
    });
    transaction(articles);
    if (added > 0) {
        log.info({ added, total: articles.length }, 'Articles ajoutés en batch');
    }
    return added;
}
/**
 * Récupère les N derniers articles d'une catégorie
 */
export function getRecentArticles(category, limit = 10) {
    const rows = db.prepare(`
    SELECT id, category, url, seen_at
    FROM netmarble_articles
    WHERE category = ?
    ORDER BY CAST(id AS INTEGER) DESC
    LIMIT ?
  `).all(category, limit);
    return rows;
}
/**
 * Nettoie les vieux articles (garde seulement les 200 derniers par catégorie)
 */
export function cleanupOldArticles() {
    const categories = ['notices', 'updates', 'known', 'devnotes'];
    for (const cat of categories) {
        const deleted = db.prepare(`
      DELETE FROM netmarble_articles
      WHERE category = ?
      AND id NOT IN (
        SELECT id FROM netmarble_articles
        WHERE category = ?
        ORDER BY CAST(id AS INTEGER) DESC
        LIMIT 200
      )
    `).run(cat, cat);
        if (deleted.changes > 0) {
            log.info({ category: cat, deleted: deleted.changes }, 'Vieux articles nettoyés');
        }
    }
}
