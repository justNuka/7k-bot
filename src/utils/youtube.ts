// utils/youtube.ts
// Petit parseur RSS YouTube sans dépendance (basé regex) + helpers.

export type YTItem = {
  videoId: string;
  title: string;
  published: string; // ISO
  link: string;
};

const FEED = (channelId: string) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;

export async function fetchYTFeed(channelId: string): Promise<YTItem[]> {
  const url = FEED(channelId);
  const res = await fetch(url, { headers: { 'User-Agent': '7k-bot/yt-rss' } });
  if (!res.ok) throw new Error(`YT RSS ${res.status} — ${url}`);
  const xml = await res.text();

  // Découpe par <entry> ... </entry>
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const items: YTItem[] = [];

  for (const e of entries) {
    const id = m1(e, /<yt:videoId>([^<]+)<\/yt:videoId>/);
    const title = decode(m1(e, /<title>([^<]+)<\/title>/));
    const published = m1(e, /<published>([^<]+)<\/published>/);
    const link = m1(e, /<link[^>]*href="([^"]+)"/);
    if (id && title && published && link) {
      items.push({ videoId: id, title, published, link });
    }
  }
  // tri décroissant par date
  items.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
  return items;
}

function m1(s: string, rx: RegExp) {
  const m = rx.exec(s);
  return m ? m[1] : '';
}
function decode(s: string) {
  return s
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}
