/**
 * Script de test pour le scraping Netmarble
 * Usage: npm run test:scrape
 */
import { fetchCategoryList } from '../scrapers/netmarble.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('TestScrape');
async function main() {
    log.info('🔍 Test du scraping des forums Netmarble (API)...');
    const categories = ['notices', 'updates', 'known', 'devnotes'];
    for (const cat of categories) {
        try {
            log.info({ category: cat }, `📰 Scraping catégorie: ${cat}`);
            const items = await fetchCategoryList(cat);
            log.info({ category: cat, count: items.length }, `✅ ${items.length} articles trouvés`);
            if (items.length > 0) {
                log.info({ category: cat }, 'Top 3 articles:');
                items.slice(0, 3).forEach((item, idx) => {
                    log.info({
                        category: cat,
                        index: idx + 1,
                        id: item.id,
                        title: item.title.substring(0, 60),
                        url: item.url,
                        date: item.date
                    }, `  ${idx + 1}. [${item.id}] ${item.title.substring(0, 60)}...`);
                });
            }
            // Pause entre requêtes pour éviter rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        catch (error) {
            const err = error;
            log.error({
                category: cat,
                error: err.message,
                stack: err.stack
            }, `❌ Erreur scraping ${cat}: ${err.message}`);
        }
    }
    log.info('✅ Test terminé');
}
main().catch((error) => {
    log.fatal({ error }, '💥 Erreur fatale');
    process.exit(1);
});
