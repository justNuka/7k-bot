/**
 * Gestion des articles Netmarble en base de données
 */
import { db } from './db.js';
import { NmCategoryKey } from '../scrapers/netmarble.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('DB:Netmarble');

export interface NetmarbleArticle {
  id: string;
  category: NmCategoryKey;
  url: string;
  seen_at: string;
}

/**
 * Récupère tous les IDs déjà vus pour une catégorie
 */
export function getSeenIds(category: NmCategoryKey): string[] {
  const rows = db.prepare(`
    SELECT id FROM netmarble_articles
    WHERE category = ?
    ORDER BY id DESC
  `).all(category) as { id: string }[];
  
  return rows.map(r => r.id);
}

/**
 * Récupère le dernier ID connu pour une catégorie (le plus grand numériquement)
 */
export function getLastKnownId(category: NmCategoryKey): number | null {
  const row = db.prepare(`
    SELECT MAX(CAST(id AS INTEGER)) as max_id
    FROM netmarble_articles
    WHERE category = ?
  `).get(category) as { max_id: number | null };
  
  return row?.max_id || null;
}

/**
 * Crée la table netmarble_meta si elle n'existe pas (migration legacy)
 */
function ensureMetaTableExists(): void {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS netmarble_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `).run();
  } catch (e) {
    log.error({ error: e }, 'Erreur création table netmarble_meta');
  }
}

/**
 * Ajoute la colonne sent_at si elle n'existe pas (migration legacy)
 */
function ensureSentAtColumnExists(): void {
  try {
    // Vérifier si la colonne existe déjà
    const tableInfo = db.prepare('PRAGMA table_info(netmarble_articles)').all() as Array<{ name: string }>;
    const hasSentAt = tableInfo.some(col => col.name === 'sent_at');
    
    if (!hasSentAt) {
      db.prepare('ALTER TABLE netmarble_articles ADD COLUMN sent_at TEXT').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_netmarble_sent_at ON netmarble_articles(sent_at)').run();
      log.info('Colonne sent_at ajoutée à netmarble_articles');
    }
  } catch (e) {
    log.error({ error: e }, 'Erreur ajout colonne sent_at');
  }
}

/**
 * Vérifie si la synchronisation initiale est complète
 */
export function isInitialSyncDone(): boolean {
  // S'assurer que la table existe (pour les DB legacy)
  ensureMetaTableExists();
  
  try {
    const row = db.prepare(`
      SELECT value FROM netmarble_meta WHERE key = 'initial_sync_done'
    `).get() as { value: string } | undefined;
    
    return row?.value === 'true';
  } catch (e) {
    log.error({ error: e }, 'Erreur vérification initial_sync_done');
    return false; // Considérer comme non fait en cas d'erreur
  }
}

/**
 * Marque la synchronisation initiale comme complète
 */
export function markInitialSyncDone(): void {
  // S'assurer que la table existe
  ensureMetaTableExists();
  
  try {
    db.prepare(`
      INSERT OR REPLACE INTO netmarble_meta (key, value)
      VALUES ('initial_sync_done', 'true')
    `).run();
    
    log.info('Synchronisation initiale Netmarble marquée comme complète');
  } catch (e) {
    log.error({ error: e }, 'Erreur marquage initial_sync_done');
  }
}

/**
 * Récupère tous les IDs déjà vus pour toutes les catégories
 */
export function getAllSeenIds(): Record<NmCategoryKey, string[]> {
  const rows = db.prepare(`
    SELECT category, id FROM netmarble_articles
    ORDER BY category, id DESC
  `).all() as { category: NmCategoryKey; id: string }[];
  
  const result: Record<NmCategoryKey, string[]> = {
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
export function isArticleSeen(category: NmCategoryKey, id: string): boolean {
  const row = db.prepare(`
    SELECT 1 FROM netmarble_articles
    WHERE category = ? AND id = ?
  `).get(category, id);
  
  return !!row;
}

/**
 * Ajoute un nouvel article
 */
export function addArticle(category: NmCategoryKey, id: string, url: string): void {
  try {
    db.prepare(`
      INSERT INTO netmarble_articles (category, id, url)
      VALUES (?, ?, ?)
    `).run(category, id, url);
    
    log.debug({ category, id }, 'Article ajouté en DB');
  } catch (e) {
    // Ignore les doublons (UNIQUE constraint)
    if (!(e as Error).message.includes('UNIQUE')) {
      log.error({ error: e, category, id }, 'Erreur ajout article');
      throw e;
    }
  }
}

/**
 * Ajoute plusieurs articles d'un coup (batch insert)
 */
export function addArticles(articles: { category: NmCategoryKey; id: string; url: string }[]): number {
  let added = 0;
  
  const insert = db.prepare(`
    INSERT OR IGNORE INTO netmarble_articles (category, id, url, sent_at)
    VALUES (?, ?, ?, NULL)
  `);
  
  const transaction = db.transaction((items: typeof articles) => {
    for (const article of items) {
      const result = insert.run(article.category, article.id, article.url);
      if (result.changes > 0) added++;
    }
  });
  
  transaction(articles);
  
  if (added > 0) {
    log.info({ added, total: articles.length }, 'Articles ajoutés en batch');
  }
  
  return added;
}

/**
 * Marque un article comme envoyé avec succès
 */
export function markArticleAsSent(category: NmCategoryKey, id: string): void {
  try {
    db.prepare(`
      UPDATE netmarble_articles
      SET sent_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE category = ? AND id = ?
    `).run(category, id);
  } catch (e) {
    log.error({ error: e, category, id }, 'Erreur marquage article envoyé');
  }
}

/**
 * Récupère tous les articles non envoyés (sent_at IS NULL)
 */
export function getUnsentArticles(): Array<{
  id: string;
  category: NmCategoryKey;
  url: string;
  seen_at: string;
}> {
  // S'assurer que la colonne sent_at existe
  ensureSentAtColumnExists();
  
  try {
    const rows = db.prepare(`
      SELECT id, category, url, seen_at
      FROM netmarble_articles
      WHERE sent_at IS NULL
      ORDER BY seen_at ASC
    `).all() as Array<{
      id: string;
      category: NmCategoryKey;
      url: string;
      seen_at: string;
    }>;
    
    return rows;
  } catch (e) {
    log.error({ error: e }, 'Erreur récupération articles non envoyés');
    return [];
  }
}

/**
 * Récupère les N derniers articles d'une catégorie
 */
export function getRecentArticles(category: NmCategoryKey, limit: number = 10): NetmarbleArticle[] {
  const rows = db.prepare(`
    SELECT id, category, url, seen_at
    FROM netmarble_articles
    WHERE category = ?
    ORDER BY CAST(id AS INTEGER) DESC
    LIMIT ?
  `).all(category, limit) as NetmarbleArticle[];
  
  return rows;
}

/**
 * Nettoie les vieux articles (garde seulement les 200 derniers par catégorie)
 */
export function cleanupOldArticles(): void {
  const categories: NmCategoryKey[] = ['notices', 'updates', 'known', 'devnotes'];
  
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
