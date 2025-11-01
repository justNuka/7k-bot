export const ROLE_IDS = {
    OFFICIERS: process.env.ROLE_OFFICIERS_ID,
    MEMBRES: process.env.ROLE_MEMBRES_ID,
    RECRUES: process.env.ROLE_RECRUES_ID,
    VISITEURS: process.env.ROLE_VISITEURS_ID,
    NOTIF_CR: process.env.ROLE_NOTIF_CR_ID,
    NOTIF_DAILY: process.env.ROLE_NOTIF_DAILY_ID,
    NOTIF_GVG: process.env.ROLE_NOTIF_GVG_ID,
};
export const CHANNEL_IDS = {
    INFOS_ANNONCES_JEU: process.env.INFOS_ANNONCES_JEU_CHANNEL_ID,
    CR_LOGS: process.env.CR_LOGS_CHANNEL_ID,
    RESSOURCES: process.env.RESSOURCES_CHANNEL_ID,
    RAPPELS: process.env.RAPPELS_CHANNEL_ID,
    RETOURS_BOT: process.env.RETOURS_BOT_CHANNEL_ID,
    COMMANDES_BOT: process.env.COMMANDES_BOT_CHANNEL_ID,
    SIGNALEMENTS: process.env.SIGNALEMENTS_CHANNEL_ID,
    WELCOME: process.env.WELCOME_CHANNEL_ID,
    LIRE_PREMIER: process.env.LIRE_PREMIER_CHANNEL_ID,
    A_PROPOS: process.env.A_PROPOS_CHANNEL_ID,
    REGLEMENT: process.env.REGLEMENT_CHANNEL_ID,
    INFOS_SERVEUR: process.env.INFOS_SERVEUR_CHANNEL_ID,
    CANDIDATURES: process.env.CANDIDATURES_CHANNEL_ID,
    PRESENTATION: process.env.PRESENTATION_CHANNEL_ID,
};
/** Règles par commande (facile à étendre plus tard) */
export const COMMAND_RULES = {
    // commandes publiques, partout
    help: { roles: [], channels: [] },
    gdoc: { roles: [], channels: [] },
    infoserveur: { roles: [], channels: [] },
    // Permissions par rôle
    'officiers-only': { roles: [ROLE_IDS.OFFICIERS], channels: [] },
    'members-only': { roles: [ROLE_IDS.MEMBRES], channels: [] },
    'recrues-only': { roles: [ROLE_IDS.RECRUES], channels: [] },
    // tout ce qui concerne le CR doit être dans #cr-logs ET par OFFICIERS
    'oubli-cr': { roles: [ROLE_IDS.OFFICIERS], channels: [CHANNEL_IDS.CR_LOGS] },
    'low-score': { roles: [ROLE_IDS.OFFICIERS], channels: [CHANNEL_IDS.CR_LOGS] },
    // Notifs
    'notif': { roles: [ROLE_IDS.OFFICIERS], channels: [CHANNEL_IDS.COMMANDES_BOT] },
    'notifpanel': { roles: [ROLE_IDS.OFFICIERS], channels: [] },
    // Bannières (officiers, salon dédié)
    'banniere': { roles: [ROLE_IDS.OFFICIERS], channels: [CHANNEL_IDS.COMMANDES_BOT] },
    // Roleset
    'roleset': { roles: [ROLE_IDS.OFFICIERS], channels: [CHANNEL_IDS.COMMANDES_BOT] },
    // Scrape
    'scrape': { roles: [ROLE_IDS.OFFICIERS], channels: [CHANNEL_IDS.RETOURS_BOT] },
    // Candidatures
    'candidatures': { roles: [ROLE_IDS.OFFICIERS], channels: [] },
    // Youtube
    'youtube': { roles: [ROLE_IDS.OFFICIERS], channels: [CHANNEL_IDS.COMMANDES_BOT] },
    'ytroute': { roles: [ROLE_IDS.OFFICIERS], channels: [CHANNEL_IDS.COMMANDES_BOT] },
    // Signalements
    'signalement': { roles: [ROLE_IDS.OFFICIERS], channels: [CHANNEL_IDS.COMMANDES_BOT, CHANNEL_IDS.SIGNALEMENTS] },
    // Bug reports (accessible à tous, partout)
    'bug': { roles: [], channels: [] },
};
