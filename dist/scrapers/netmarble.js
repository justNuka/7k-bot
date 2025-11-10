/**
 * Scraper pour les forums officiels Netmarble (Seven Knights Re:BIRTH)
 * Détecte les nouveaux posts en vérifiant les IDs des derniers articles publiés
 *
 * Stratégie: Test séquentiel des IDs pour détecter les nouveaux posts
 * Car le forum Netmarble est une SPA sans API REST ni RSS disponibles
 */
import fetch from 'node-fetch';
const BASE = 'https://forum.netmarble.com';
const FORUM_ID = 'sk_rebirth_gl';
const CAT_TO_MENU = {
    notices: 10,
    updates: 11,
    known: 12,
    devnotes: 13,
};
/**
 * Récupère les derniers articles d'une catégorie en testant les IDs récents
 * Teste les 50 derniers IDs possibles pour détecter les nouveaux posts
 *
 * @param cat Catégorie (notices, updates, known, devnotes)
 * @param lastKnownId Le dernier ID connu (optionnel, par défaut teste les 50 derniers depuis 1300)
 * @returns Liste des articles trouvés
 */
export async function fetchCategoryList(cat, lastKnownId) {
    const menuSeq = CAT_TO_MENU[cat];
    // Démarrer la recherche depuis le dernier ID connu, ou depuis un ID récent estimé
    // Les IDs augmentent au fil du temps, donc on teste les 50 derniers
    const startId = lastKnownId ? lastKnownId : 1250; // ID estimé récent (Nov 2025)
    const range = 50; // Nombre d'IDs à tester
    const items = [];
    const promises = [];
    // Test parallèle des IDs pour gagner du temps
    for (let i = startId; i < startId + range; i++) {
        const articleId = i;
        const url = `${BASE}/${FORUM_ID}/view/${menuSeq}/${articleId}`;
        const promise = fetch(url, {
            method: 'HEAD', // HEAD request pour vérifier l'existence sans télécharger le HTML
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            redirect: 'manual', // Ne pas suivre les redirections (404 → homepage)
        })
            .then(async (response) => {
            // 200 = article existe, 3xx = redirection (article n'existe pas ou supprimé)
            if (response.status === 200) {
                // Récupérer le titre en faisant une requête GET sur la page
                try {
                    const htmlRes = await fetch(url, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        },
                    });
                    const html = await htmlRes.text();
                    // Extraire le titre depuis la balise <title>
                    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
                    let title = titleMatch ? titleMatch[1].trim() : `Article #${articleId}`;
                    // Nettoyer le titre (enlever "Seven Knights Re:BIRTH - ")
                    title = title.replace(/^.*?\s*-\s*/, '').trim();
                    items.push({
                        id: String(articleId),
                        cat,
                        title,
                        url,
                    });
                }
                catch {
                    // Si erreur de parsing, ajouter quand même l'article avec titre générique
                    items.push({
                        id: String(articleId),
                        cat,
                        title: `New ${cat} post #${articleId}`,
                        url,
                    });
                }
            }
        })
            .catch(() => {
            // Ignorer les erreurs réseau (timeout, etc.)
        });
        promises.push(promise);
        // Rate limiting : attendre 100ms entre chaque batch de 10 requêtes
        if ((i - startId + 1) % 10 === 0) {
            await Promise.all(promises.splice(0, promises.length));
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    // Attendre les dernières requêtes
    await Promise.all(promises);
    // Trier par ID décroissant (plus récent en premier)
    items.sort((a, b) => parseInt(b.id) - parseInt(a.id));
    return items;
}
