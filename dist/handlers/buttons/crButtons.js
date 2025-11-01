import { db } from '../../db/db.js';
import { pushLog } from '../../http/logs.js';
export async function handleCrButtons(i) {
    // On ne traite que nos IDs
    if (!i.customId.startsWith('cr:confirm:resetTotal:'))
        return false;
    const action = i.customId.split(':').pop(); // "yes" | "no"
    if (action === 'no') {
        try {
            await i.update({ content: '✅ Annulé.', components: [] });
        }
        catch {
            await i.editReply({ content: '✅ Annulé.', components: [] }).catch(() => { });
        }
        return true;
    }
    if (action === 'yes') {
        // Reset de TOUTES les stats globales
        db.prepare('DELETE FROM cr_counters').run();
        pushLog({
            ts: new Date().toISOString(),
            level: 'action',
            component: 'cr',
            msg: `[CR] RESET GLOBAL confirmé par ${i.user.tag}`,
            meta: { by: i.user.id },
        });
        try {
            await i.update({
                content: '♻️ Tous les compteurs **globaux** ont été remis à 0.',
                components: [],
            });
        }
        catch {
            await i.editReply({
                content: '♻️ Tous les compteurs **globaux** ont été remis à 0.',
                components: [],
            }).catch(() => { });
        }
        return true;
    }
    return false;
}
