/**
 * Scraper pour les forums officiels Netmarble (Seven Knights Re:BIRTH)
 * Solution simple : on surveille quelques IDs récents connus
 */
import fetch from 'node-fetch';

export type NmCategoryKey = 'notices' | 'updates' | 'known' | 'devnotes';
export type NmListItem = { 
  id: string; 
  cat: NmCategoryKey; 
  title: string; 
  url: string; 
  date?: string 
};

const BASE = 'https://forum.netmarble.com';
const FORUM_ID = 'sk_rebirth_gl';

const CAT_TO_MENU: Record<NmCategoryKey, number> = {
  notices: 10,
  updates: 11,
  known: 12,
  devnotes: 13,
};

// IDs de départ connus (exemples fournis par l'utilisateur)
const KNOWN_LATEST_IDS: Record<NmCategoryKey, number> = {
  notices: 532,
  updates: 996,
  known: 1012,
  devnotes: 975,
};

/**
 * Récupère les derniers articles en testant les IDs après le dernier connu
 * Retourne les articles dont l'URL répond (HTTP 200)
 */
export async function fetchCategoryList(cat: NmCategoryKey): Promise<NmListItem[]> {
  const menuSeq = CAT_TO_MENU[cat];
  const latestKnown = KNOWN_LATEST_IDS[cat];
  
  // On teste les 30 IDs suivants le dernier connu
  const range = 30;
  const items: NmListItem[] = [];
  
  for (let i = latestKnown; i < latestKnown + range; i++) {
    const url = `${BASE}/${FORUM_ID}/view/${menuSeq}/${i}`;
    
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        redirect: 'manual', // Ne pas suivre les redirections (404 → homepage)
      });
      
      // 200 = article existe, 3xx = redirection (article n'existe pas)
      if (response.status === 200) {
        items.push({
          id: String(i),
          cat,
          title: `New ${cat} post`,
          url,
        });
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
      
    } catch (e) {
      // Ignorer les erreurs réseau
    }
  }
  
  return items;
}
