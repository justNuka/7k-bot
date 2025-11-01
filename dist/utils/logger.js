/**
 * Logger structuré Pino pour toute l'application
 *
 * Utilisation :
 * ```ts
 * import { log } from './utils/logger.js';
 * log.info({ user: 'john' }, 'User logged in');
 * log.error({ err }, 'Something failed');
 * ```
 *
 * Ou avec contexte module :
 * ```ts
 * import { createLogger } from './utils/logger.js';
 * const log = createLogger('MyModule');
 * log.info('Module started');
 * ```
 *
 * @module utils/logger
 */
import pino from 'pino';
/**
 * Logger Pino principal de l'application
 *
 * Niveau configuré via LOG_LEVEL (debug, info, warn, error)
 * En développement : pretty print colorisé
 * En production : JSON structuré
 */
export const log = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
});
/**
 * Crée un logger enfant avec un contexte module
 *
 * @param module Nom du module (ex: 'BOT', 'DB', 'NOTIF')
 * @returns Logger Pino avec contexte ajouté à chaque log
 *
 * @example
 * ```ts
 * const log = createLogger('AUTH');
 * log.info({ userId: 123 }, 'User authenticated');
 * // Output: {"level":30,"time":...,"module":"AUTH","userId":123,"msg":"User authenticated"}
 * ```
 */
export function createLogger(module) {
    return log.child({ module });
}
