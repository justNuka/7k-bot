// utils/youtube.ts
// Petit parseur RSS YouTube sans dépendance (basé regex) + helpers.
const FEED = (channelId) => `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
export async function fetchYTFeed(channelId) {
    const url = FEED(channelId);
    const res = await fetch(url, { headers: { 'User-Agent': '7k-bot/yt-rss' } });
    if (!res.ok)
        throw new Error(`YT RSS ${res.status} — ${url}`);
    const xml = await res.text();
    // Découpe par <entry> ... </entry>
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
    const items = [];
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
function m1(s, rx) {
    const m = rx.exec(s);
    return m ? m[1] : '';
}
function decode(s) {
    return s
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'");
}
