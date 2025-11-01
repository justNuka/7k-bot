/**
 * Gestion des signalements de bugs en base de données
 */
import { db } from './db.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('DB:Bugs');
/**
 * Génère un ID unique pour un bug report
 */
function generateBugId() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toISOString().slice(11, 19).replace(/:/g, '');
    const random = Math.random().toString(36).substring(2, 6);
    return `bug_${date}_${time}_${random}`;
}
/**
 * Crée un nouveau signalement de bug
 */
export function createBugReport(data) {
    const id = generateBugId();
    const created_at = new Date().toISOString();
    db.prepare(`
    INSERT INTO bug_reports (
      id, user_id, command, description, error_message, status, created_at
    ) VALUES (?, ?, ?, ?, ?, 'open', ?)
  `).run(id, data.user_id, data.command || null, data.description, data.error_message || null, created_at);
    log.info({ id, userId: data.user_id, command: data.command }, 'Bug report créé');
    return {
        id,
        user_id: data.user_id,
        command: data.command || null,
        description: data.description,
        error_message: data.error_message || null,
        status: 'open',
        created_at,
        resolved_by: null,
        resolved_at: null,
        resolution: null
    };
}
/**
 * Récupère un bug report par ID
 */
export function getBugReport(id) {
    const row = db.prepare(`
    SELECT * FROM bug_reports WHERE id = ?
  `).get(id);
    return row || null;
}
/**
 * Liste tous les bugs (avec filtre optionnel par status)
 */
export function listBugReports(status) {
    if (status) {
        return db.prepare(`
      SELECT * FROM bug_reports
      WHERE status = ?
      ORDER BY created_at DESC
    `).all(status);
    }
    return db.prepare(`
    SELECT * FROM bug_reports
    ORDER BY created_at DESC
  `).all();
}
/**
 * Récupère les bugs d'un utilisateur
 */
export function getUserBugReports(userId) {
    return db.prepare(`
    SELECT * FROM bug_reports
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId);
}
/**
 * Met à jour le statut d'un bug
 */
export function updateBugStatus(id, status, resolvedBy, resolution) {
    const resolved_at = (status === 'resolved' || status === 'wontfix')
        ? new Date().toISOString()
        : null;
    const result = db.prepare(`
    UPDATE bug_reports
    SET status = ?,
        resolved_by = ?,
        resolved_at = ?,
        resolution = ?
    WHERE id = ?
  `).run(status, resolvedBy || null, resolved_at, resolution || null, id);
    if (result.changes > 0) {
        log.info({ id, status, resolvedBy }, 'Bug status mis à jour');
        return true;
    }
    return false;
}
/**
 * Compte les bugs par statut
 */
export function countBugsByStatus() {
    const rows = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM bug_reports
    GROUP BY status
  `).all();
    const counts = {
        open: 0,
        in_progress: 0,
        resolved: 0,
        wontfix: 0
    };
    for (const row of rows) {
        counts[row.status] = row.count;
    }
    return counts;
}
