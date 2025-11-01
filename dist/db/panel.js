// src/app/db/panel.ts
import { db } from './db.js';
const upsertStmt = db.prepare(`
  INSERT INTO notif_panel_ref (id, channel_id, message_id, updated_at)
  VALUES (1, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    channel_id = excluded.channel_id,
    message_id = excluded.message_id,
    updated_at = excluded.updated_at
`);
const getStmt = db.prepare(`
  SELECT channel_id, message_id, updated_at
  FROM notif_panel_ref
  WHERE id = 1
`);
/**
 * Accepte soit:
 *  - { channelId, messageId } (camelCase)  ← utilisé par utils/notifPanel.ts
 *  - { channel_id, message_id } (snakeCase)← utilisé par commands/notifpanel.ts
 */
export function savePanelRef(ref) {
    const now = new Date().toISOString();
    const channel = 'channelId' in ref ? ref.channelId : ref.channel_id;
    const message = 'messageId' in ref ? ref.messageId : ref.message_id;
    upsertStmt.run(channel, message, now);
}
// Alias rétro-compatible pour l’usage existant dans la commande
export function setPanelRef(ref) {
    savePanelRef(ref);
}
export function getPanelRef() {
    const row = getStmt.get();
    return row ?? null;
}
