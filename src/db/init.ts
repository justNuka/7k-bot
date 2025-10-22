import { readFileSync } from 'fs';
import { db } from './db.js';
import { readJson } from '../utils/storage.js';

export function runMigrations() {
  const sql = readFileSync('src/db/schema.sql', 'utf8');
  db.exec(sql);
  console.log('[DB] schema ensured');
}

export async function migrateFromJsonIfEmpty() {
  // counters
  const hasCounters = db.prepare('SELECT count(*) c FROM cr_counters').get() as any;
  if (!hasCounters.c) {
    const counters = await readJson<Record<string,number>>('src/data/crCounters.json', {});
    const ins = db.prepare('INSERT OR REPLACE INTO cr_counters(user_id,total) VALUES(?,?)');
    const tx = db.transaction((rows) => { for (const [k,v] of Object.entries(rows)) ins.run(k, v ?? 0); });
    tx(counters);
    console.log('[DB] migrated cr_counters');
  }

  // week
  const hasWeek = db.prepare('SELECT count(*) c FROM cr_week').get() as any;
  if (!hasWeek.c) {
    const wk = await readJson<any>('src/data/crWeek.json', null);
    if (wk?.weekStart && wk?.days) {
      const ins = db.prepare('INSERT INTO cr_week(week_start,day,user_id) VALUES(?,?,?)');
      const tx = db.transaction((w) => {
        for (const [day, list] of Object.entries(w.days)) for (const uid of list as string[]) {
          ins.run(w.weekStart, day, uid);
        }
      });
      tx(wk);
      console.log('[DB] migrated cr_week');
    }
  }

  // low scores
  const hasLow = db.prepare('SELECT count(*) c FROM low_week').get() as any;
  if (!hasLow.c) {
    const lw = await readJson<any>('src/data/crLow.json', null);
    if (lw?.weekStart && lw?.days) {
      const ins = db.prepare('INSERT INTO low_week(week_start,day,user_id,score,note) VALUES(?,?,?,?,?)');
      const tx = db.transaction((w) => {
        for (const [day, list] of Object.entries(w.days)) for (const e of list as any[]) {
          ins.run(w.weekStart, day, e.userId, e.score, e.note ?? null);
        }
      });
      tx(lw);
      console.log('[DB] migrated low_week');
    }
  }

  // notifs
  const hasNotifs = db.prepare('SELECT count(*) c FROM notifs').get() as any;
  if (!hasNotifs.c) {
    const ns = await readJson<any[]>('src/data/notifs.json', []);
    const ins = db.prepare('INSERT OR REPLACE INTO notifs(id,role_id,channel_id,spec,tz,message,created_by) VALUES(?,?,?,?,?,?,?)');
    const tx = db.transaction((list) => { for (const n of list) ins.run(n.id,n.roleId,n.channelId,n.spec,n.tz,n.message,n.createdBy); });
    tx(ns);
    console.log('[DB] migrated notifs');
  }

  // banners
  const hasBan = db.prepare('SELECT count(*) c FROM banners').get() as any;
  if (!hasBan.c) {
    const list = await readJson<any[]>('src/data/banners.json', []);
    const ins = db.prepare('INSERT OR REPLACE INTO banners(id,name,start_iso,end_iso,note,image,added_by) VALUES(?,?,?,?,?,?,?)');
    const tx = db.transaction((arr) => { for (const b of arr) ins.run(b.id,b.name,b.start,b.end,b.note ?? null,b.image ?? null,b.addedBy); });
    tx(list);
    console.log('[DB] migrated banners');
  }

  // yt
  const hasYt = db.prepare('SELECT count(*) c FROM yt_subs').get() as any;
  if (!hasYt.c) {
    const subs = await readJson<any[]>('src/data/youtube.json', []);
    const ins = db.prepare('INSERT OR REPLACE INTO yt_subs(id,channel_id,thread_id,title,last_video,added_by) VALUES(?,?,?,?,?,?)');
    const tx = db.transaction((arr) => { for (const s of arr) ins.run(s.id,s.channelId,s.threadId,s.title ?? null,s.lastVideoId ?? null,s.addedBy); });
    tx(subs);
    console.log('[DB] migrated yt_subs');
  }
  const hasRoutes = db.prepare('SELECT count(*) c FROM yt_routes').get() as any;
  if (!hasRoutes.c) {
    const routes = await readJson<any[]>('src/data/ytRoutes.json', []);
    const ins = db.prepare('INSERT OR REPLACE INTO yt_routes(id,pattern,thread_id,forum_id,post_title) VALUES(?,?,?,?,?)');
    const tx = db.transaction((arr) => { for (const r of arr) ins.run(r.id,r.pattern,r.threadId ?? null,r.forumId ?? null,r.postTitle ?? null); });
    tx(routes);
    console.log('[DB] migrated yt_routes');
  }
}
