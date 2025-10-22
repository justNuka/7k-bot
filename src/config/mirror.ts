// 🔕 NE RIEN MIRRORER (aucun log/offload).
// Utilise ça pour les commandes très bruyantes ou purement consultatives
// où tu ne veux même pas de trace dans #retours-du-bot.
export const MIRROR_PING_BLOCKLIST = new Set<string>([
  // CR (consultation)
  'oubli-cr:top',          // classement global oublis
  'oubli-cr:week',         // récap hebdo oublis

  // Low score (consultation)
  'low-score:week',

  // Bannière (consultation)
  'banniere:list',
  'banniere:next',

  // Notifications (consultation / debug)
  'notif:list',
  'notif:test',

  // Panneau notifs
  'notifpanel',            // panneau d’inscription (on postera un log séparé si besoin)

  // Public info
  'help',
  'gdoc',
  'infoserveur',

  // Roleset
  'roleset:list',

  // Scraping
  'scrape:status',
  'scrape:log',
  'scrape:latest',

  // Candidatures
  'candidatures:list',

  // Absences list
  'absence:list',

  // YouTube
  'yt:list',
  'ytroute:list',

  // Signalements
  'signalement:list',
]);

// 🔔 MIRROR + PING @Officiers pour les actions importantes (mutations/réglages)
// Ajoute ici les *actions* où tu veux absolument un ping visible.
export const MIRROR_PING_ALLOWLIST = new Set<string>([
  // CR (mutations)
  'oubli-cr:add',
  'oubli-cr:reset',
  'oubli-cr:reset total',
  'oubli-cr:reset week',

  // Low score (mutations)
  'low-score:add',
  'low-score:reset',

  // Bannière (mutations)
  'banniere:add',
  'banniere:edit',
  'banniere:remove',

  // Notifs (mutations)
  'notif:add',
  'notif:edit',
  'notif:remove',

  // Rôles (mutations)
  'roleset:add',
  'roleset:swap',
  'roleset:remove',

  // Candidatures (boutons accept/reject sont gérés dans le handler custom
  'candidatures:accept',
  'candidatures:reject',

  // Kick send
  'kick:send',
]);

// Helper pour composer la clé "commande[:sub]"
export function cmdKey(commandName?: string, sub?: string | null) {
  const c = commandName ?? 'unknown';
  const s = sub ? `:${sub}` : '';
  return `${c}${s}`;
}
