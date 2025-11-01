// scripts/json2db.ts
import 'dotenv/config';
import { db } from '../db/db.js';
import { readJson } from '../utils/storage.js';
function hasColumn(table, col) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    return cols.some(c => c.name === col);
}
async function importPanel() {
    const panel = await readJson('src/data/notifPanel.json', null);
    if (panel?.channelId && panel?.messageId) {
        const now = new Date().toISOString();
        db.prepare(`
      INSERT INTO notif_panel_ref(id, channel_id, message_id, updated_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        channel_id = excluded.channel_id,
        message_id = excluded.message_id,
        updated_at = excluded.updated_at
    `).run(panel.channelId, panel.messageId, now);
        console.log('✓ notif_panel_ref imported');
    }
    else {
        console.log('— notifPanel.json absent/incomplet, skip');
    }
}
async function importYTRoutes() {
    const routes = await readJson('src/data/ytRoutes.json', []);
    if (!routes.length) {
        console.log('— ytRoutes.json vide, skip');
        return;
    }
    const ins = db.prepare(`
    INSERT OR REPLACE INTO yt_routes(id, pattern, thread_id, forum_id, post_title, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
    const tx = db.transaction((arr) => {
        const now = new Date().toISOString();
        for (const r of arr) {
            ins.run(r.id, r.pattern, r.threadId ?? null, r.forumId ?? null, r.postTitle ?? null, now);
        }
    });
    tx(routes);
    console.log(`✓ yt_routes imported (${routes.length})`);
}
async function importNotifs() {
    const list = await readJson('src/data/notifs.json', []);
    if (!list.length) {
        console.log('— notifs.json vide, skip');
        return;
    }
    // Colonnes (selon ton schéma final)
    const hasCreatedAt = hasColumn('notifs', 'created_at');
    const hasUpdatedAt = hasColumn('notifs', 'updated_at');
    // Prépare SQL dynamiquement (pour ne pas casser si colonnes manquent)
    const now = new Date().toISOString();
    const baseCols = ['id', 'role_id', 'channel_id', 'spec', 'tz', 'message', 'created_by'];
    const baseVals = ['?', '?', '?', '?', '?', '?', '?'];
    if (hasCreatedAt) {
        baseCols.push('created_at');
        baseVals.push('?');
    }
    if (hasUpdatedAt) {
        baseCols.push('updated_at');
        baseVals.push('?');
    }
    const sql = `
    INSERT OR REPLACE INTO notifs(${baseCols.join(',')})
    VALUES (${baseVals.join(',')})
  `;
    const ins = db.prepare(sql);
    const tx = db.transaction((arr) => {
        for (const n of arr) {
            const params = [
                n.id, n.roleId, n.channelId, n.spec, n.tz, n.message, n.createdBy
            ];
            if (hasCreatedAt)
                params.push(now);
            if (hasUpdatedAt)
                params.push(now);
            ins.run(...params);
        }
    });
    tx(list);
    console.log(`✓ notifs imported (${list.length})`);
}
async function importCandidatures() {
    const store = await readJson('src/data/candidatures.json', null);
    if (!store || (!store.open?.length && !store.closed?.length)) {
        console.log('— candidatures.json vide, skip');
        return;
    }
    const openList = Array.isArray(store.open) ? store.open : [];
    const closedList = Array.isArray(store.closed) ? store.closed : [];
    // Détection colonnes optionnelles
    const hasModeratorId = hasColumn('candidatures', 'moderator_id');
    const hasClosedAt = hasColumn('candidatures', 'closed_at');
    // Colonnes fixes de ta table
    const baseCols = ['id', 'user_id', 'created_at', 'channel_id', 'message_url', 'has_attachments', 'status'];
    const baseVals = ['?', '?', '?', '?', '?', '?', '?'];
    if (hasModeratorId) {
        baseCols.push('moderator_id');
        baseVals.push('?');
    }
    if (hasClosedAt) {
        baseCols.push('closed_at');
        baseVals.push('?');
    }
    const sql = `
    INSERT OR REPLACE INTO candidatures(${baseCols.join(',')})
    VALUES (${baseVals.join(',')})
  `;
    const ins = db.prepare(sql);
    const tx = db.transaction((openItems, closedItems) => {
        // OPEN
        for (const c of openItems) {
            const id = String(c.id);
            const params = [
                id,
                c.userId,
                c.createdAt,
                c.channelId,
                c.jumpLink ?? null,
                0,
                'open'
            ];
            if (hasModeratorId)
                params.push(null);
            if (hasClosedAt)
                params.push(null);
            ins.run(...params);
        }
        // CLOSED
        for (const c of closedItems) {
            const id = String(c.id);
            const params = [
                id,
                c.userId,
                c.createdAt,
                c.channelId,
                c.jumpLink ?? null,
                0,
                c.status === 'accepted' ? 'accepted' : 'rejected'
            ];
            if (hasModeratorId)
                params.push(c.moderatorId ?? null);
            if (hasClosedAt)
                params.push(c.closedAt ?? null);
            ins.run(...params);
        }
    });
    tx(openList, closedList);
    console.log(`✓ candidatures imported (open=${openList.length}, closed=${closedList.length})`);
}
async function main() {
    await importPanel();
    await importYTRoutes();
    await importNotifs();
    await importCandidatures();
}
main().catch(e => { console.error(e); process.exit(1); });
