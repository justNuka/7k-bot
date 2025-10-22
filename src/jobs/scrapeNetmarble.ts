import cron from 'node-cron';
import { fetchCategoryList, fetchArticleDetail, NmCategoryKey } from '../scrapers/netmarble.js';
import { readJson, writeJson } from '../utils/storage.js';
import { sendToChannel } from '../utils/send.js';
import { makeEmbed } from '../utils/embed.js';
import { CHANNEL_IDS } from '../config/permissions.js';

type SeenStore = Record<NmCategoryKey, string[]>; // ids déjà vus
const STORE = 'src/data/scraped_seen.json';

const CATS: NmCategoryKey[] = ['notices','updates','known','devnotes'];

async function getSeen(): Promise<SeenStore> {
  return await readJson<SeenStore>(STORE, { notices:[], updates:[], known:[], devnotes:[] });
}
async function setSeen(s: SeenStore) { await writeJson(STORE, s); }

function catLabel(cat: NmCategoryKey) {
  return cat === 'notices' ? 'Notice'
       : cat === 'updates' ? 'Update'
       : cat === 'known'   ? 'Known issues'
       : 'Developer Notes';
}

export async function scrapeOnceAndNotify(client: any) {
  const channelId = CHANNEL_IDS.INFOS_ANNONCES_JEU || CHANNEL_IDS.RETOURS_BOT; // fallback si pas de canal dédié
  if (!channelId) { console.warn('[SCRAPE] No channel configured.'); return; }

  const seen = await getSeen();
  const newPosts: { cat: NmCategoryKey; id: string; title: string; url: string; date?: string }[] = [];

  for (const cat of CATS) {
    try {
      const list = await fetchCategoryList(cat);
      const known = new Set(seen[cat] || []);
      // du plus récent au plus ancien
      for (const it of list) {
        if (!known.has(it.id)) {
          newPosts.push(it);
          known.add(it.id);
        }
      }
      seen[cat] = Array.from(known).slice(-200); // garde historique raisonnable
    } catch (e) {
      console.error('[SCRAPE] list error', cat, e);
    }
  }

  // rien de neuf → on sort
  if (newPosts.length === 0) {
    console.log('[SCRAPE] No new posts.');
    await setSeen(seen);
    return;
  }

  // poste un embed par nouveau post (ou regroupe si tu préfères)
  for (const p of newPosts) {
    try {
      const detail = await fetchArticleDetail(p.url).catch(()=>null);
      const emb = makeEmbed({
        title: `📰 ${catLabel(p.cat)} — ${p.title}`,
        url: p.url,
        description: detail?.text ? (detail.text.slice(0, 800) + (detail.text.length>800 ? '…' : '')) : (p.date ? `Publié: ${p.date}` : undefined),
        footer: `Catégorie: ${catLabel(p.cat)}`
      });
      await sendToChannel(client, channelId, { embeds: [emb] });
    } catch (e) {
      console.error('[SCRAPE] post error', p.url, e);
    }
  }

  await setSeen(seen);
  console.log(`[SCRAPE] Posted ${newPosts.length} new item(s).`);
}

/** Planifie le scraping récurrent (par défaut: toutes les 6h) */
export function registerScrapeJob(client: any) {
  const spec = process.env.SCRAPE_CRON || '0 */6 * * *';
  const tz = process.env.RESET_CRON_TZ || 'Europe/Paris';
  cron.schedule(spec, () => scrapeOnceAndNotify(client), { timezone: tz });
}
