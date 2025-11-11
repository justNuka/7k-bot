import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import { fetchCategoryList } from '../scrapers/netmarble.js';
import { sendToChannel } from '../utils/discord/send.js';
import { CHANNEL_IDS, ROLE_IDS } from '../config/permissions.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('ScrapeNetmarble');
const CATS = ['notices', 'updates', 'known', 'devnotes'];
function catLabel(cat) {
    return cat === 'notices' ? 'Notice'
        : cat === 'updates' ? 'Update'
            : cat === 'known' ? 'Known Issue'
                : 'Developer Note';
}
function catEmoji(cat) {
    return cat === 'notices' ? '📢'
        : cat === 'updates' ? '🔄'
            : cat === 'known' ? '⚠️'
                : '💬';
}
function catColor(cat) {
    return cat === 'notices' ? 0x5865F2 // Bleu Discord
        : cat === 'updates' ? 0x57F287 // Vert
            : cat === 'known' ? 0xFEE75C // Jaune
                : 0xEB459E; // Rose
}
/**
 * Republier les articles qui n'ont pas été envoyés avec succès
 * Appelé au démarrage du bot pour rattraper les notifications manquées
 */
export async function retryUnsentArticles(client) {
    const channelId = CHANNEL_IDS.INFOS_ANNONCES_JEU || CHANNEL_IDS.RETOURS_BOT;
    if (!channelId) {
        log.warn('Pas de canal configuré pour republier les articles non envoyés');
        return;
    }
    const { getUnsentArticles, markArticleAsSent } = await import('../db/netmarble.js');
    const unsentArticles = getUnsentArticles();
    if (unsentArticles.length === 0) {
        log.info('Aucun article non envoyé à republier');
        return;
    }
    log.info({ count: unsentArticles.length }, `📬 Republication de ${unsentArticles.length} articles non envoyés`);
    for (const article of unsentArticles) {
        try {
            const cat = article.category;
            const emoji = catEmoji(cat);
            const label = catLabel(cat);
            const color = catColor(cat);
            // Ping le rôle seulement pour devnotes et updates
            const shouldPing = cat === 'devnotes' || cat === 'updates';
            const roleId = ROLE_IDS.NOTIF_ANNONCES_JEU;
            const content = shouldPing && roleId ? `<@&${roleId}>` : undefined;
            // Date de découverte formatée
            const seenDate = new Date(article.seen_at);
            const dateStr = seenDate.toLocaleString('fr-FR', {
                dateStyle: 'short',
                timeStyle: 'short',
                timeZone: 'Europe/Paris'
            });
            const emb = new EmbedBuilder()
                .setColor(color)
                .setTitle(`${emoji} Nouveau post #${article.id}`)
                .setURL(article.url)
                .setDescription(`**Catégorie:** ${label}\n\n` +
                `Un nouveau post a été publié sur le forum officiel de Seven Knights Re:BIRTH.\n\n` +
                `**[📖 Cliquez ici pour lire l'article complet →](${article.url})**`)
                .addFields({
                name: '🔗 Lien direct',
                value: `[${article.url}](${article.url})`,
                inline: false
            }, {
                name: '📅 Découvert le',
                value: dateStr,
                inline: true
            })
                .setFooter({
                text: `${label} • Seven Knights Re:BIRTH • Republication automatique`,
                iconURL: 'https://sgimage.netmarble.com/images/netmarble/tskgb/20250908/vqew1757311454668.png'
            })
                .setTimestamp(seenDate);
            await sendToChannel(client, channelId, { content, embeds: [emb] });
            // Marquer comme envoyé
            markArticleAsSent(cat, article.id);
            log.info({
                category: cat,
                id: article.id,
                url: article.url,
                seenAt: article.seen_at,
                pinged: shouldPing
            }, `Article republié: ${label} #${article.id}`);
            // Petit délai entre chaque envoi pour éviter le rate limit
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        catch (e) {
            const err = e;
            log.error({
                category: article.category,
                id: article.id,
                url: article.url,
                error: err.message
            }, 'Erreur republication article');
        }
    }
    log.info({ count: unsentArticles.length }, '✅ Republication terminée');
}
export async function scrapeOnceAndNotify(client) {
    const channelId = CHANNEL_IDS.INFOS_ANNONCES_JEU || CHANNEL_IDS.RETOURS_BOT; // fallback si pas de canal dédié
    if (!channelId) {
        log.warn('Pas de canal configuré pour le scraping');
        return;
    }
    // Import dynamique pour accéder aux fonctions DB
    const { getAllSeenIds, getLastKnownId, addArticles, cleanupOldArticles, isInitialSyncDone, markInitialSyncDone } = await import('../db/netmarble.js');
    // Vérifier si c'est la première synchronisation
    const isFirstRun = !isInitialSyncDone();
    if (isFirstRun) {
        log.info('🔄 Première synchronisation Netmarble - aucune notification ne sera envoyée');
    }
    // Récupérer les IDs déjà vus depuis la DB
    const seenByCategory = getAllSeenIds();
    const newPosts = [];
    const articlesToAdd = [];
    for (const cat of CATS) {
        try {
            // Récupérer le dernier ID connu pour optimiser la recherche
            const lastId = getLastKnownId(cat);
            log.debug({ category: cat, lastKnownId: lastId }, `Scraping ${cat} depuis ID ${lastId || 'début'}`);
            const list = await fetchCategoryList(cat, lastId || undefined);
            const known = new Set(seenByCategory[cat] || []);
            // Logger le dernier article trouvé (le plus récent)
            if (list.length > 0) {
                const latest = list[0]; // Premier élément = plus récent
                log.info({
                    category: cat,
                    categoryLabel: catLabel(cat),
                    latestId: latest.id,
                    latestTitle: latest.title,
                    latestUrl: latest.url,
                    totalFound: list.length
                }, `📊 ${catLabel(cat)}: dernier article #${latest.id}`);
            }
            else {
                log.info({ category: cat, categoryLabel: catLabel(cat) }, `📊 ${catLabel(cat)}: aucun article trouvé`);
            }
            // du plus récent au plus ancien
            for (const it of list) {
                if (!known.has(it.id)) {
                    newPosts.push(it);
                    articlesToAdd.push({ category: cat, id: it.id, url: it.url });
                }
            }
        }
        catch (e) {
            log.error({ category: cat, error: e }, 'Erreur scraping liste');
        }
    }
    // rien de neuf → on sort
    if (newPosts.length === 0) {
        log.info('Aucun nouveau post Netmarble');
        // Nettoyage périodique (garde les 200 derniers par catégorie)
        cleanupOldArticles();
        // Si c'était le premier run, on le marque comme fait même s'il n'y avait rien
        if (isFirstRun) {
            markInitialSyncDone();
        }
        return;
    }
    // Sauvegarder les nouveaux articles en DB (batch insert)
    addArticles(articlesToAdd);
    // Si c'est le premier run, on enregistre les articles mais on ne notifie pas
    if (isFirstRun) {
        log.info({ count: newPosts.length }, '✅ Synchronisation initiale terminée - articles enregistrés sans notification');
        markInitialSyncDone();
        cleanupOldArticles();
        return;
    }
    // Poste un embed stylisé pour chaque nouveau post (seulement après le premier run)
    for (const p of newPosts) {
        try {
            const emoji = catEmoji(p.cat);
            const label = catLabel(p.cat);
            const color = catColor(p.cat);
            // Ping le rôle seulement pour devnotes et updates
            const shouldPing = p.cat === 'devnotes' || p.cat === 'updates';
            const roleId = ROLE_IDS.NOTIF_ANNONCES_JEU;
            const content = shouldPing && roleId ? `<@&${roleId}>` : undefined;
            const emb = new EmbedBuilder()
                .setColor(color)
                .setTitle(`${emoji} Nouveau post #${p.id}`)
                .setURL(p.url)
                .setDescription(`**Catégorie:** ${label}\n\n` +
                `Un nouveau post a été publié sur le forum officiel de Seven Knights Re:BIRTH.\n\n` +
                `**[📖 Cliquez ici pour lire l'article complet →](${p.url})**`)
                .addFields({
                name: '🔗 Lien direct',
                value: `[${p.url}](${p.url})`,
                inline: false
            })
                .setFooter({
                text: `${label} • Seven Knights Re:BIRTH`,
                iconURL: 'https://sgimage.netmarble.com/images/netmarble/tskgb/20250908/vqew1757311454668.png'
            })
                .setTimestamp(new Date());
            await sendToChannel(client, channelId, { content, embeds: [emb] });
            // Marquer l'article comme envoyé avec succès
            const { markArticleAsSent } = await import('../db/netmarble.js');
            markArticleAsSent(p.cat, p.id);
            log.info({
                category: p.cat,
                id: p.id,
                url: p.url,
                pinged: shouldPing
            }, `Notification envoyée: ${label} #${p.id}`);
        }
        catch (e) {
            const err = e;
            log.error({
                category: p.cat,
                id: p.id,
                url: p.url,
                error: err.message
            }, 'Erreur envoi notification');
            // Ne pas marquer comme envoyé en cas d'erreur
        }
    }
    log.info({ count: newPosts.length }, 'Posts Netmarble publiés');
    // Nettoyage périodique
    cleanupOldArticles();
}
/** Planifie le scraping récurrent (par défaut: toutes les heures) */
export function registerScrapeJob(client) {
    const spec = process.env.SCRAPE_CRON || '0 * * * *';
    const tz = process.env.RESET_CRON_TZ || 'Europe/Paris';
    cron.schedule(spec, () => scrapeOnceAndNotify(client), { timezone: tz });
    log.info({ cron: spec, timezone: tz }, 'Job de scraping Netmarble programmé');
}
