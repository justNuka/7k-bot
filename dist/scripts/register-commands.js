import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { data as help } from '../commands/help.js';
import { data as helpadmin } from '../commands/helpadmin.js';
import { data as gdoc } from '../commands/gdoc.js';
import { data as infoserveur } from '../commands/infoserveur.js';
import { data as oubliCr } from '../commands/oubli-cr.js';
import { data as lowScore } from '../commands/low-score.js';
import { data as notif } from '../commands/notif.js';
import { data as notifpanel } from '../commands/notifpanel.js';
import { data as annoncespanel } from '../commands/annoncespanel.js';
import { data as banniere } from '../commands/banniere.js';
import { data as roleset } from '../commands/roleset.js';
import { data as scrape } from '../commands/scrape.js';
import { data as candidatures } from '../commands/candidatures.js';
import { data as kick } from '../commands/kick.js';
import { data as absence } from '../commands/absence.js';
import { data as yt } from '../commands/yt.js';
import { data as ytroute } from '../commands/ytroute.js';
import { data as signalement } from '../commands/signalement.js';
import { data as diag } from '../commands/diag.js';
import { data as coaching } from '../commands/coaching.js';
import { data as changelog } from '../commands/changelog.js';
import { data as pingoff } from '../commands/pingoff.js';
const token = process.env.DISCORD_TOKEN;
const appId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID;
const commands = [
    help,
    helpadmin,
    gdoc,
    infoserveur,
    oubliCr,
    lowScore,
    notif,
    notifpanel,
    annoncespanel,
    banniere,
    roleset,
    scrape,
    candidatures,
    absence,
    kick,
    yt,
    ytroute,
    signalement,
    diag,
    coaching,
    changelog,
    pingoff,
].map(c => c.toJSON());
console.log('AppId:', appId);
console.log('GuildId:', guildId ?? '(global)');
const rest = new REST({ version: '10' }).setToken(token);
(async () => {
    try {
        if (guildId) {
            console.log('→ Registering GUILD commands…');
            await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
            console.log('✅ Guild commands enregistrées');
        }
    }
    catch (e) {
        console.error('❌ Register failed:', e?.code, e?.status, e?.rawError ?? e);
        console.error('Tips: bot invité ? appId ↔ token ok ? guildId correct ? scopes ok ?');
        process.exit(1);
    }
})();
