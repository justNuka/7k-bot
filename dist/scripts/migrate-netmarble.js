/**
 * Script de migration : JSON → SQLite pour les articles Netmarble
 * Usage: npm run migrate:netmarble
 */
import { addArticles } from '../db/netmarble.js';
import { readJson } from '../utils/storage.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('MigrateNetmarble');
const JSON_PATH = 'src/data/scraped_seen.json';
async function main() {
    log.info('🔄 Migration des articles Netmarble (JSON → SQLite)...');
    try {
        // Lire le fichier JSON
        const seen = await readJson(JSON_PATH, {
            notices: [],
            updates: [],
            known: [],
            devnotes: []
        });
        const articles = [];
        // Convertir en format DB
        for (const cat of ['notices', 'updates', 'known', 'devnotes']) {
            const ids = seen[cat] || [];
            log.info({ category: cat, count: ids.length }, `Articles ${cat} trouvés dans JSON`);
            for (const id of ids) {
                const categoryId = cat === 'notices' ? 10
                    : cat === 'updates' ? 11
                        : cat === 'known' ? 12
                            : 13;
                articles.push({
                    category: cat,
                    id,
                    url: `https://forum.netmarble.com/sk_rebirth_gl/view/${categoryId}/${id}`
                });
            }
        }
        // Insérer en base
        const added = addArticles(articles);
        log.info({ total: articles.length, added }, '✅ Migration terminée');
        if (added > 0) {
            log.info('💡 Tu peux maintenant supprimer le fichier JSON : src/data/scraped_seen.json');
        }
        else {
            log.info('ℹ️  Tous les articles étaient déjà en base');
        }
    }
    catch (e) {
        log.fatal({ error: e }, '💥 Erreur migration');
        process.exit(1);
    }
}
main().catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
});
