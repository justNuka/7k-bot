// Dotenv
import 'dotenv/config';

// Discord imports
import { Client, GatewayIntentBits, EmbedBuilder, ActivityType } from 'discord.js';

// Lib imports
import { promises as fs } from 'node:fs';
import path from 'node:path';
import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// JSON imports
import heroes from './data/heroes.json' with { type: 'json' };
import tier from './data/tierlist.json' with { type: 'json' };
import banners from './data/banners.json' with { type: 'json' };

// Utils
import { sendToChannel } from './utils/send.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const bannersPath = path.resolve(process.cwd(), 'src/data/banners.json');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('clientReady', async () => {
  console.log(`Connecté comme ${client.user?.tag}`);
  client.user?.setPresence({
    activities: [{ name: 'Seven Knights Rebirth', type: ActivityType.Watching }],
    status: 'online'
  });
  if (process.env.ANNOUNCE_CHANNEL_ID) {
    await sendToChannel(client, process.env.ANNOUNCE_CHANNEL_ID, '✅ Bot en ligne');
  }
});

// /time reset
async function handleTime(subtype: string) {
  if (subtype !== 'reset') return 'Type inconnu.';
  // ex: reset quotidien à 05:00 Europe/Paris
  const now = dayjs().tz(process.env.RESET_CRON_TZ || 'Europe/Paris');
  const next = now.hour() < 5 ? now.hour(5).minute(0).second(0) : now.add(1,'day').hour(5).minute(0).second(0);
  const diff = next.diff(now, 'minute');
  return `Prochain reset: **${next.format('DD/MM HH:mm')}** (${diff} min).`;
}

// /calc gemmes
function handleCalc(gemmes: number, parJour: number, jusquau: string) {
  const now = dayjs();
  const end = dayjs(jusquau);
  if (!end.isValid() || end.isBefore(now)) return 'Date invalide.';
  const days = end.diff(now, 'day');
  const total = gemmes + days * parJour;
  const pulls = Math.floor(total / 300); // ex: 300 gemmes par pull
  return `D’ici le ${end.format('DD/MM')}: **${total}** gemmes ≈ **${pulls} pulls**.`;
}

// /hero
function handleHero(nom: string) {
  const key = nom.toLowerCase().trim();
  const h = (heroes as any[]).find(x => x.key === key || x.name.toLowerCase() === key);
  if (!h) return 'Héros introuvable.';
  const embed = new EmbedBuilder()
    .setTitle(`${h.name} — ${h.role} (${h.element})`)
    .setDescription(h.notes || '')
    .addFields(
      { name: 'Skills', value: (h.skills || []).join(' • ') || '—' },
      { name: 'Build', value: h.build || '—' },
    )
    .setFooter({ text: '7K Rebirth Bot' });
  return { embed };
}

// /tier
async function handleTier(mode: 'pvp'|'pve') {
  const list = (tier as any)[mode] as Array<{name:string;tier:string;notes?:string}>;
  if (!list?.length) return 'Pas de données.';
  const lines = list.map(x => `**${x.tier}** — ${x.name}${x.notes ? ` — _${x.notes}_` : ''}`).join('\n');
  const embed = new EmbedBuilder()
    .setTitle(`Tierlist ${mode.toUpperCase()}`)
    .setDescription(lines)
    .setFooter({ text: '7K Rebirth Bot' });
  return { embed };
}

// Get next banner
function nextBanner() {
  const now = dayjs();
  const upcoming = (banners as any[]).filter(b => dayjs(b.end).isAfter(now))
    .sort((a,b)=> dayjs(a.start).valueOf()-dayjs(b.start).valueOf());
  return upcoming[0];
}

// Add a banner
async function addBanner(name: string, start: string, end: string) {
  const arr = banners as any[];
  arr.push({ name, start, end });
  await fs.writeFile(bannersPath, JSON.stringify(arr, null, 2), 'utf8');
}

client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand()) return;
  try {
    if (i.commandName === 'time') {
      const type = i.options.getString('type', true);
      await i.reply(await handleTime(type));
    } else if (i.commandName === 'calc') {
      const g = i.options.getInteger('gemmes', true);
      const pj = i.options.getInteger('par_jour', true);
      const d = i.options.getString('jusquau', true);
      await i.reply(handleCalc(g, pj, d));
    } else if (i.commandName === 'hero') {
      const nom = i.options.getString('nom', true);
      const res = handleHero(nom);
      if (typeof res === 'string') return i.reply(res);
      await i.reply({ embeds: [res.embed] });
    } else if (i.commandName === 'tier') {
      const mode = i.options.getString('mode', true) as 'pvp'|'pve';
      const res = await handleTier(mode);
      if (typeof res === 'string') return i.reply(res);
      await i.reply({ embeds: [res.embed] });
    } else if (i.commandName === 'banner') {
      const sub = i.options.getSubcommand();
      if (sub === 'next') {
        const b = nextBanner();
        if (!b) return i.reply('Aucune bannière à venir.');
        const start = dayjs(b.start).tz('Europe/Paris').format('DD/MM HH:mm');
        const end = dayjs(b.end).tz('Europe/Paris').format('DD/MM HH:mm');
        return i.reply(`**${b.name}** — du ${start} au ${end} (heure Paris).`);
      }
      if (sub === 'list') {
        const lines = (banners as any[]).map(b =>
          `• ${b.name} — ${dayjs(b.start).tz('Europe/Paris').format('DD/MM')} → ${dayjs(b.end).tz('Europe/Paris').format('DD/MM')}`
        ).join('\n');
        return i.reply(lines || 'Aucune bannière.');
      }
      if (sub === 'add') {
        // Optionnel: restreindre aux admins
        if (!i.memberPermissions?.has('ManageGuild')) {
          return i.reply({ content: 'Réservé aux admins.', ephemeral: true });
        }
        const name = i.options.getString('name', true);
        const start = i.options.getString('start', true);
        const end = i.options.getString('end', true);
        await addBanner(name, start, end);
        return i.reply(`Ajouté: **${name}**`);
      }
    }
  } catch (e) {
    console.error(e);
    if (i.deferred || i.replied) i.followUp('Erreur inattendue.');
    else i.reply('Erreur inattendue.');
  }
});

// Cron: rappel reset
cron.schedule(process.env.RESET_CRON || '0 5 * * *', async () => {
  const channelId = process.env.ANNOUNCE_CHANNEL_ID!;
  await sendToChannel(client, channelId, '🔔 **Reset quotidien** — Bon farm !');
}, { timezone: process.env.RESET_CRON_TZ || 'Europe/Paris' });

client.login(process.env.DISCORD_TOKEN);
