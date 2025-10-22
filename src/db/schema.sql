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

-- Low scores hebdo
CREATE TABLE IF NOT EXISTS low_week (
  week_start TEXT NOT NULL,
  day        TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  score      INTEGER NOT NULL,
  note       TEXT
);

-- Notifications planifiées
CREATE TABLE IF NOT EXISTS notifs (
  id         TEXT PRIMARY KEY,
  role_id    TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  spec       TEXT NOT NULL,
  tz         TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_by TEXT NOT NULL
);

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

-- YouTube
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
  post_title TEXT
);
