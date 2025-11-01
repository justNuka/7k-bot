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
    INSERT OR IGNORE INTO netmarble_articles (category, id, url)
    VALUES (?, ?, ?)
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
