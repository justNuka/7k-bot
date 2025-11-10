import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import { fetchCategoryList, NmCategoryKey } from '../scrapers/netmarble.js';
import { getAllSeenIds, addArticles, cleanupOldArticles } from '../db/netmarble.js';
import { sendToChannel } from '../utils/discord/send.js';
import { CHANNEL_IDS, ROLE_IDS } from '../config/permissions.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ScrapeNetmarble');

const CATS: NmCategoryKey[] = ['notices','updates','known','devnotes'];

function catLabel(cat: NmCategoryKey) {
  return cat === 'notices' ? 'Notice'
       : cat === 'updates' ? 'Update'
       : cat === 'known'   ? 'Known Issue'
       : 'Developer Note';
}

function catEmoji(cat: NmCategoryKey) {
  return cat === 'notices' ? '📢'
       : cat === 'updates' ? '🔄'
       : cat === 'known'   ? '⚠️'
       : '💬';
}

function catColor(cat: NmCategoryKey): number {
  return cat === 'notices' ? 0x5865F2 // Bleu Discord
       : cat === 'updates' ? 0x57F287 // Vert
       : cat === 'known'   ? 0xFEE75C // Jaune
       : 0xEB459E; // Rose
}

export async function scrapeOnceAndNotify(client: any) {
  const channelId = CHANNEL_IDS.INFOS_ANNONCES_JEU || CHANNEL_IDS.RETOURS_BOT; // fallback si pas de canal dédié
  if (!channelId) { log.warn('Pas de canal configuré pour le scraping'); return; }

  // Récupérer les IDs déjà vus depuis la DB
  const seenByCategory = getAllSeenIds();
  const newPosts: { cat: NmCategoryKey; id: string; title: string; url: string; date?: string }[] = [];
  const articlesToAdd: { category: NmCategoryKey; id: string; url: string }[] = [];

  for (const cat of CATS) {
    try {
      const list = await fetchCategoryList(cat);
      const known = new Set(seenByCategory[cat] || []);
      
      // du plus récent au plus ancien
      for (const it of list) {
        if (!known.has(it.id)) {
          newPosts.push(it);
          articlesToAdd.push({ category: cat, id: it.id, url: it.url });
        }
      }
    } catch (e) {
      log.error({ category: cat, error: e }, 'Erreur scraping liste');
    }
  }

  // rien de neuf → on sort
  if (newPosts.length === 0) {
    log.info('Aucun nouveau post Netmarble');
    // Nettoyage périodique (garde les 200 derniers par catégorie)
    cleanupOldArticles();
    return;
  }

  // Sauvegarder les nouveaux articles en DB (batch insert)
  addArticles(articlesToAdd);

  // Poste un embed stylisé pour chaque nouveau post
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
        .setTitle(`${emoji} **${label}** — Nouveau post`)
        .setURL(p.url)
        .setDescription(`Un nouveau post a été publié dans la catégorie **${label}**.\n\n[📖 Lire l'article complet](${p.url})`)
        .setFooter({ text: `Catégorie: ${label} • Seven Knights Re:BIRTH` })
        .setTimestamp(new Date());
      
      await sendToChannel(client, channelId, { content, embeds: [emb] });
      
      log.info({ 
        category: p.cat, 
        id: p.id, 
        url: p.url,
        pinged: shouldPing 
      }, `Notification envoyée: ${label} #${p.id}`);
      
    } catch (e) {
      const err = e as Error;
      log.error({ 
        url: p.url, 
        error: err.message 
      }, 'Erreur envoi notification');
    }
  }

  log.info({ count: newPosts.length }, 'Posts Netmarble publiés');
  
  // Nettoyage périodique
  cleanupOldArticles();
}

/** Planifie le scraping récurrent (par défaut: toutes les heures) */
export function registerScrapeJob(client: any) {
  const spec = process.env.SCRAPE_CRON || '0 * * * *';
  const tz = process.env.RESET_CRON_TZ || 'Europe/Paris';
  cron.schedule(spec, () => scrapeOnceAndNotify(client), { timezone: tz });
  log.info({ cron: spec, timezone: tz }, 'Job de scraping Netmarble programmé');
}
