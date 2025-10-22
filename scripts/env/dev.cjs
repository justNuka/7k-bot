// scripts/env/dev.cjs
// Charge .env avant (via -r dotenv/config), puis mappe DEV_* -> clés normales.

const KEYS = [
  // Clés Discord (pas besoin de les redéfinir en dev, les mêmes sont utilisées en dev et)
  // 'DISCORD_TOKEN',
  // 'DISCORD_CLIENT_ID',

  // Serveur Discord
  'GUILD_ID',

  // Rôles
  'ROLE_OFFICIERS_ID',
  'ROLE_CR_ID',

  // Channels divers
  'ANNOUNCE_CHANNEL_ID',
  'RESSOURCES_CHANNEL_ID',
  'CHANNEL_GUIDES_TIERLIST_ID',
  'CHANNEL_ANNONCES_JEU_ID',
  'CHANNEL_ABSENCES_ID',
  'CR_LOGS_CHANNEL_ID',
  'INFOS_ANNONCES_JEU_CHANNEL_ID',

  // Cron
  'RESET_CRON',
  'RESET_CRON_TZ',

  // CR hebdo
  'CR_WEEKLY_RESET_CRON',
];

// Petit log pour vérifier visuellement (désactive si tu veux)
const LOG = process.env.DEV_ENV_LOG === '1';

for (const k of KEYS) {
  const dk = `DEV_${k}`;
  if (process.env[dk] !== undefined) {
    const before = process.env[k];
    process.env[k] = process.env[dk]; // ⬅️ on ECRASE si DEV_* existe
    if (LOG) console.log(`[DEV MAP] ${dk} -> ${k} (${before || '(none)'} => ${process.env[k]})`);
  }
}

// Marqueur pratique
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
