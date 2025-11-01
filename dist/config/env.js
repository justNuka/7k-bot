/**
 * Validation des variables d'environnement
 *
 * Ce module valide que toutes les variables d'environnement requises sont présentes
 * au démarrage du bot. Fail-fast si une config est manquante.
 *
 * @module config/env
 */
import { createLogger } from '../utils/logger.js';
const log = createLogger('ENV');
/**
 * Liste des variables d'environnement requises
 */
const REQUIRED_VARS = [
    'DISCORD_TOKEN',
    'GUILD_ID',
];
/**
 * Valide qu'une variable d'environnement est présente et non vide
 */
function validateRequired(key) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
        throw new Error(`Variable d'environnement manquante: ${key}`);
    }
    return value;
}
/**
 * Valide et retourne la configuration de l'application
 *
 * Vérifie que toutes les variables requises sont présentes.
 * Lance une erreur avec un message clair si une config est manquante.
 *
 * @throws {Error} Si une variable requise est manquante
 * @returns Configuration validée et typée
 *
 * @example
 * ```ts
 * try {
 *   const env = validateEnv();
 *   console.log('Config OK:', env.DISCORD_TOKEN);
 * } catch (err) {
 *   console.error('Config invalide:', err.message);
 *   process.exit(1);
 * }
 * ```
 */
export function validateEnv() {
    log.info('Validation des variables d\'environnement...');
    // Valider les variables requises
    const missing = [];
    for (const key of REQUIRED_VARS) {
        if (!process.env[key] || process.env[key]?.trim() === '') {
            missing.push(key);
        }
    }
    if (missing.length > 0) {
        const error = `Variables d'environnement manquantes: ${missing.join(', ')}`;
        log.fatal({ missing }, error);
        throw new Error(error);
    }
    // Construire la config typée
    const env = {
        DISCORD_TOKEN: validateRequired('DISCORD_TOKEN'),
        GUILD_ID: validateRequired('GUILD_ID'),
        ANNOUNCE_CHANNEL_ID: process.env.ANNOUNCE_CHANNEL_ID,
        ROLE_OFFICIERS_ID: process.env.ROLE_OFFICIERS_ID,
        DASH_PORT: parseInt(process.env.DASH_PORT || '8787', 10),
        DASH_API_KEY: process.env.DASH_API_KEY,
        SQLITE_PATH: process.env.SQLITE_PATH,
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        NODE_ENV: process.env.NODE_ENV || 'development',
    };
    log.info({
        nodeEnv: env.NODE_ENV,
        logLevel: env.LOG_LEVEL,
        dashPort: env.DASH_PORT,
        hasDashKey: !!env.DASH_API_KEY,
        hasAnnounceChannel: !!env.ANNOUNCE_CHANNEL_ID,
    }, 'Variables d\'environnement validées');
    return env;
}
/**
 * Affiche un résumé de la configuration (sans secrets)
 */
export function logEnvSummary(env) {
    log.info({
        discord: {
            tokenLength: env.DISCORD_TOKEN.length,
            guildId: env.GUILD_ID,
        },
        dashboard: {
            port: env.DASH_PORT,
            hasApiKey: !!env.DASH_API_KEY,
        },
        database: {
            path: env.SQLITE_PATH || 'default',
        },
        environment: {
            node: env.NODE_ENV,
            logLevel: env.LOG_LEVEL,
        },
    }, 'Configuration chargée');
}
