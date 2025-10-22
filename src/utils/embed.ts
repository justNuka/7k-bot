import { EmbedBuilder, type APIEmbedField } from 'discord.js';

export const EMBED_COLOR = 0x5865F2; // Discord blurple

type MakeEmbedArgs = {
  title?: string;
  description?: string;
  fields?: APIEmbedField[];
  footer?: string;
  // optional timestamp to show in the embed footer (Discord will render it)
  timestamp?: string | number | Date;
  thumbnail?: string;
  url?: string;
};

export function makeEmbed({
  title,
  description,
  fields,
  footer,
  thumbnail,
  url,
  timestamp
}: MakeEmbedArgs) {
  const e = new EmbedBuilder().setColor(EMBED_COLOR);

  if (title) e.setTitle(title);
  if (description) e.setDescription(description);
  if (url) e.setURL(url);
  if (thumbnail) e.setThumbnail(thumbnail);
  if (fields?.length) e.addFields(fields);
  e.setFooter({ text: footer ?? '7K Rebirth Bot' });

  if (timestamp) {
    // Accept string/number/Date; convert string to Date for safety
    const ts = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    e.setTimestamp(ts as Date);
  }

  return e;
}

// Petit helper pour /hero
type Hero = {
  name: string;
  role?: string;
  element?: string;
  skills?: string[];
  build?: string;
  notes?: string;
  image?: string;
};

export function heroEmbed(h: Hero) {
  const fields: APIEmbedField[] = [];
  if (h.skills?.length) fields.push({ name: 'Skills', value: h.skills.join(' • ') });
  if (h.build)        fields.push({ name: 'Build',  value: h.build });
  if (h.notes)        fields.push({ name: 'Notes',  value: h.notes });

  const title =
    h.name +
    (h.role ? ` — ${h.role}` : '') +
    (h.element ? ` (${h.element})` : '');

  const e = makeEmbed({
    title,
    description: '',
    fields,
    thumbnail: h.image
  });

  return e;
}
