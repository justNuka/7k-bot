#!/usr/bin/env node
/**
 * Script de test du scraper Netmarble
 * Usage: npm run test:scrape
 */
import { fetchCategoryList } from '../scrapers/netmarble.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('TestScrape');
async function main() {
    log.info('Test du scraper Netmarble...');
    const categories = ['notices', 'updates', 'known', 'devnotes'];
    for (const cat of categories) {
        try {
            log.info({ category: cat }, `Scraping ${cat}...`);
            const items = await fetchCategoryList(cat);
            log.info({ category: cat, count: items.length }, `Trouvé ${items.length} articles`);
            // Afficher les 5 premiers
            items.slice(0, 5).forEach(item => {
                log.info({
                    id: item.id,
                    title: item.title,
                    url: item.url
                }, `  → ${item.title}`);
            });
        }
        catch (e) {
            const err = e;
            log.error({ category: cat, error: err.message }, `Erreur scraping ${cat}`);
        }
    }
    log.info('Test terminé');
}
main().catch(err => {
    log.fatal(err, 'Test failed');
    process.exit(1);
});
