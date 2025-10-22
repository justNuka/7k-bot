import type { Client, ForumChannel, AnyThreadChannel, Channel } from 'discord.js';
import { readJson, writeJson } from './storage.js';

export type YTRoute = {
  id: string;               // ex: rt_...
  pattern: string;          // RegExp source (i)
  threadId?: string;        // si déjà un thread cible
  forumId?: string;         // sinon forum + postTitle
  postTitle?: string;       // titre du post (thread) à créer/trouver
};

const STORE = 'src/data/ytRoutes.json';

export async function loadYTRoutes(): Promise<YTRoute[]> {
  return await readJson<YTRoute[]>(STORE, []);
}
export async function saveYTRoutes(list: YTRoute[]) {
  await writeJson(STORE, list);
}

export function newRouteId() {
  const s = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0,14);
  const r = Math.random().toString(36).slice(2,6);
  return `rt_${s}_${r}`;
}

/** trouve la 1ère route dont le pattern matche le titre (case-insensitive) */
export async function resolveRoute(client: Client, title: string): Promise<{threadId: string} | null> {
  const routes = await loadYTRoutes();
  for (const r of routes) {
    const rx = new RegExp(r.pattern, 'i');
    if (!rx.test(title)) continue;

    if (r.threadId) return { threadId: r.threadId };

    if (r.forumId && r.postTitle) {
      const tId = await ensureForumPost(client, r.forumId, r.postTitle);
      if (tId) return { threadId: tId };
    }
  }
  return null;
}

/** Retrouve ou crée un post (thread) dans un forum par titre exact. */
export async function ensureForumPost(client: Client, forumId: string, postTitle: string): Promise<string | null> {
  const ch = await client.channels.fetch(forumId).catch(() => null) as Channel | null;
  if (!ch || ch.type !== 15) return null; // 15 = ForumChannel

  const forum = ch as ForumChannel;

  // 1) chercher dans threads actifs
  const active = await forum.threads.fetchActive();
  const foundActive = active.threads.find(t => t.name.toLowerCase() === postTitle.toLowerCase());
  if (foundActive) return foundActive.id;

  // 2) chercher dans threads archivés
  const archived = await forum.threads.fetchArchived();
  const foundArchived = archived.threads.find(t => t.name.toLowerCase() === postTitle.toLowerCase());
  if (foundArchived) return foundArchived.id;

  // 3) créer le post
  const created = await forum.threads.create({
    name: postTitle,
    message: { content: `📌 Fil automatique pour **${postTitle}** — nouvelles vidéos ici.` }
  }).catch(() => null) as AnyThreadChannel | null;

  return created?.id ?? null;
}
