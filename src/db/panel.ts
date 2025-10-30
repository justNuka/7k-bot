// src/app/db/panel.ts
import { db } from './db.js';

export type PanelRef = {
  channel_id: string;
  message_id: string;
  updated_at: string; // ISO
};

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
export function savePanelRef(
  ref:
    | { channelId: string; messageId: string }
    | { channel_id: string; message_id: string }
) {
  const now = new Date().toISOString();
  const channel =
    'channelId' in ref ? ref.channelId : (ref as any).channel_id;
  const message =
    'messageId' in ref ? ref.messageId : (ref as any).message_id;
  upsertStmt.run(channel, message, now);
}

// Alias rétro-compatible pour l’usage existant dans la commande
export function setPanelRef(ref: { channel_id: string; message_id: string }) {
  savePanelRef(ref);
}

export function getPanelRef(): PanelRef | null {
  const row = getStmt.get() as PanelRef | undefined;
  return row ?? null;
}
