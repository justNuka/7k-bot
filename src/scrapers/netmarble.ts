import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export type NmCategoryKey = 'notices' | 'updates' | 'known' | 'devnotes';
export type NmListItem = { id: string; cat: NmCategoryKey; title: string; url: string; date?: string };
export type NmDetail = { title: string; html: string; text: string };

const BASE = 'https://forum.netmarble.com';
const PATHS: Record<NmCategoryKey, string> = {
  notices: '/sk_rebirth_gl/list/10/1',
  updates: '/sk_rebirth_gl/list/11/1',
  known:   '/sk_rebirth_gl/list/12/1',
  devnotes:'/sk_rebirth_gl/list/13/1',
};

function headers() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.8,fr;q=0.6',
    'Connection': 'keep-alive',
    'Referer': BASE,
  };
}

/** Télécharge une URL texte avec headers réalistes */
async function get(url: string): Promise<string> {
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
  return await r.text();
}

/** Parse la liste d’une catégorie (page 1). Renvoie items (title + url). */
export async function fetchCategoryList(cat: NmCategoryKey): Promise<NmListItem[]> {
  const url = BASE + PATHS[cat];
  const html = await get(url);
  const $ = cheerio.load(html);

  // Sélecteurs robustes : liens avec data-router="view/<catnum>/<id>"
  const items: NmListItem[] = [];
  $('a.medium[data-router^="view/"]').each((_, a) => {
    const $a = $(a);
    const router = String($a.attr('data-router') || '');
    const href = String($a.attr('href') || '');
    const title = $a.text().trim();

    // router: "view/11/996" -> id = "996"
    const m = /^view\/(\d+)\/(\d+)$/.exec(router);
    if (!m) return;

    const id = m[2];
    const full = BASE + href;
    // date si visible à côté du lien (à ajuster si structure diffère)
    const date = $a.closest('li, tr, .list-item').find('.date,.regdate,.time').first().text().trim() || undefined;

    items.push({ id, cat, title, url: full, date });
  });

  // fallback si structure différente : choper tous les <a> “view/*”
  if (items.length === 0) {
    $('a[href^="/sk_rebirth_gl/view/"]').each((_, a) => {
      const $a = $(a); const href = String($a.attr('href') || '');
      const title = $a.text().trim();
      const m = /\/view\/(\d+)\/(\d+)$/.exec(href);
      if (!m) return;
      const id = m[2];
      const full = BASE + href;
      items.push({ id, cat, title, url: full });
    });
  }

  return items;
}

/** Détail d’un article : tente d’extraire le bloc principal en HTML + texte */
export async function fetchArticleDetail(url: string): Promise<NmDetail> {
  const html = await get(url);
  const $ = cheerio.load(html);

  const title =
    $('h1, .title, .subject').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    'Untitled';

  // divers conteneurs fréquents pour le corps de l’article
  const body =
    $('.fr-view').first().html() ||
    $('.board_view, .article_view, .content, article').first().html() ||
    $('main').first().html() ||
    $('body').html() || '';

  const cleanHtml = body
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '');

  const text = cheerio.load(cleanHtml)('body').text().replace(/\s+\n/g, '\n').trim();

  return { title, html: cleanHtml, text };
}
