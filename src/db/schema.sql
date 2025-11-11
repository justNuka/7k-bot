-- Schéma de la base de données SQLite utilisée par le bot

-- Membres
CREATE TABLE IF NOT EXISTS members (
  user_id     TEXT PRIMARY KEY,
  username    TEXT,          -- global username (@handle)
  display_name TEXT,         -- nickname côté guilde si dispo
  avatar      TEXT,          -- hash d'avatar utilisateur
  updated_at  INTEGER        -- epoch ms (cache)
);

-- CR (oublis globaux)
CREATE TABLE IF NOT EXISTS cr_counters (
  user_id TEXT PRIMARY KEY,
  total   INTEGER NOT NULL
);

-- CR hebdo
CREATE TABLE IF NOT EXISTS cr_week (
  week_start TEXT NOT NULL,        -- YYYY-MM-DD
  day        TEXT NOT NULL,        -- mon..sun
  user_id    TEXT NOT NULL
);

-- Index petite table “semaines” (optionnel mais pratique)
CREATE TABLE IF NOT EXISTS cr_weeks (
  week_start TEXT PRIMARY KEY   -- YYYY-MM-DD
);

-- Historique des oublis par semaine
CREATE TABLE IF NOT EXISTS cr_week_history (
  week_start TEXT NOT NULL,
  day        TEXT NOT NULL,     -- mon..sun
  user_id    TEXT NOT NULL,
  PRIMARY KEY (week_start, day, user_id)
);

-- Low scores hebdo
CREATE TABLE IF NOT EXISTS low_week (
  week_start TEXT NOT NULL,
  day        TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  score      INTEGER NOT NULL,
  note       TEXT
);

-- Historique des low scores par semaine
CREATE TABLE IF NOT EXISTS low_week_history (
  week_start TEXT NOT NULL,
  day        TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  score      INTEGER NOT NULL,
  note       TEXT,
  PRIMARY KEY (week_start, day, user_id, score) -- score différencie les entrées
);

-- Index APRES la création des tables concernées
CREATE UNIQUE INDEX IF NOT EXISTS cr_week_uq
ON cr_week(week_start, day, user_id);

-- Bannières
CREATE TABLE IF NOT EXISTS banners (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  start_iso TEXT NOT NULL,
  end_iso   TEXT NOT NULL,
  note      TEXT,
  image     TEXT,
  added_by  TEXT NOT NULL
);

-- Candidatures
CREATE TABLE IF NOT EXISTS candidatures (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  channel_id       TEXT NOT NULL,
  message_url      TEXT,
  has_attachments  INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'open' -- open|accepted|rejected
);

-- Absences (full DB)
CREATE TABLE IF NOT EXISTS absences (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  start_iso  TEXT NOT NULL,  -- ISO (YYYY-MM-DD ou ISO complet)
  end_iso    TEXT NOT NULL,  -- ISO (inclusif)
  reason     TEXT,
  note       TEXT,
  created_at TEXT NOT NULL
);

-- Pour les listes "en cours / à venir"
CREATE INDEX IF NOT EXISTS absences_end_idx   ON absences(date(end_iso));
CREATE INDEX IF NOT EXISTS absences_start_idx ON absences(date(start_iso));
CREATE INDEX IF NOT EXISTS absences_user_idx  ON absences(user_id);

-- Signalements
CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,     -- ex: rp_20251020_1234
  target_id   TEXT NOT NULL,        -- user concerné
  note        TEXT NOT NULL,
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL         -- ISO
);

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);

-- Notifications planifiées (cron)
CREATE TABLE IF NOT EXISTS notifs (
  id          TEXT PRIMARY KEY,     -- ex: nf_20251021_154233_abcd
  role_id     TEXT NOT NULL,
  channel_id  TEXT NOT NULL,
  spec        TEXT NOT NULL,        -- cron (node-cron)
  tz          TEXT NOT NULL,        -- ex: Europe/Paris
  message     TEXT NOT NULL,
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- === Panneau de rappels ===
CREATE TABLE IF NOT EXISTS notif_panel_ref (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  channel_id  TEXT NOT NULL,
  message_id  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS notifs_touch
AFTER UPDATE ON notifs
FOR EACH ROW
BEGIN
  UPDATE notifs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- === YouTube ===
CREATE TABLE IF NOT EXISTS yt_subs (
  id          TEXT PRIMARY KEY,
  channel_id  TEXT NOT NULL,
  thread_id   TEXT NOT NULL,
  title       TEXT,
  last_video  TEXT,
  added_by    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS yt_routes (
  id         TEXT PRIMARY KEY,
  pattern    TEXT NOT NULL,
  thread_id  TEXT,
  forum_id   TEXT,
  post_title TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Demandes d'aide / coaching
CREATE TABLE IF NOT EXISTS coaching_requests (
  id                TEXT PRIMARY KEY,            -- ex: crq_20251030_142233_abcd
  user_id           TEXT NOT NULL,               -- demandeur
  origin_channel_id TEXT NOT NULL,               -- où la demande a été faite
  type              TEXT NOT NULL,               -- 'help' | 'coaching'
  message           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open',-- 'open' | 'accepted' | 'closed'
  created_at        TEXT NOT NULL,               -- ISO

  accepted_by       TEXT,                        -- officier
  accepted_at       TEXT,                        -- ISO

  closed_by         TEXT,                        -- officier
  closed_at         TEXT,                        -- ISO
  close_note        TEXT                         -- note optionnelle
);

CREATE INDEX IF NOT EXISTS idx_coaching_status  ON coaching_requests(status);
CREATE INDEX IF NOT EXISTS idx_coaching_created ON coaching_requests(created_at);

-- Articles Netmarble scrapés
CREATE TABLE IF NOT EXISTS netmarble_articles (
  id         TEXT NOT NULL,                    -- ID de l'article (ex: "532")
  category   TEXT NOT NULL,                    -- 'notices' | 'updates' | 'known' | 'devnotes'
  url        TEXT NOT NULL,                    -- URL complète de l'article
  seen_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), -- Date de découverte
  sent_at    TEXT,                             -- Date d'envoi Discord (NULL = pas encore envoyé)
  PRIMARY KEY (category, id)
);

CREATE INDEX IF NOT EXISTS idx_netmarble_category ON netmarble_articles(category);
CREATE INDEX IF NOT EXISTS idx_netmarble_seen_at ON netmarble_articles(seen_at);
CREATE INDEX IF NOT EXISTS idx_netmarble_sent_at ON netmarble_articles(sent_at);

-- Métadonnées scraping Netmarble (sync initiale, etc.)
CREATE TABLE IF NOT EXISTS netmarble_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Signalements de bugs
CREATE TABLE IF NOT EXISTS bug_reports (
  id            TEXT PRIMARY KEY,                 -- ex: bug_20251101_123456_abcd
  user_id       TEXT NOT NULL,                    -- utilisateur signalant le bug
  command       TEXT,                             -- commande concernée (null si "Autre")
  description   TEXT NOT NULL,                    -- description du bug
  error_message TEXT,                             -- message d'erreur (optionnel)
  status        TEXT NOT NULL DEFAULT 'open',     -- 'open' | 'in_progress' | 'resolved' | 'wontfix'
  created_at    TEXT NOT NULL,                    -- ISO timestamp
  
  resolved_by   TEXT,                             -- officier qui a résolu
  resolved_at   TEXT,                             -- ISO timestamp
  resolution    TEXT                              -- note de résolution
);

CREATE INDEX IF NOT EXISTS idx_bug_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_created ON bug_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_bug_user ON bug_reports(user_id);

-- Historique des modifications (audit log) pour le dashboard
CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name    TEXT NOT NULL,                    -- 'notifs', 'absences', 'banners', etc.
  record_id     TEXT NOT NULL,                    -- ID de l'enregistrement modifié
  action        TEXT NOT NULL,                    -- 'create' | 'update' | 'delete'
  user_email    TEXT NOT NULL,                    -- email de l'utilisateur (via NextAuth)
  changes       TEXT,                             -- JSON avec les changements (pour update)
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))  -- timestamp ISO
);

CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
