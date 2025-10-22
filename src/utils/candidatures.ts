import { readJson, writeJson } from './storage.js';

const STORE = 'src/data/candidatures.json';

export type CandidatureOpen = {
  id: number;
  userId: string;
  createdAt: string; // ISO
  guildId: string;
  channelId: string;
  messageId: string;
  jumpLink: string;
};
export type CandidatureClosed = CandidatureOpen & {
  closedAt: string; // ISO
  status: 'accepted' | 'rejected';
  moderatorId: string;
};

type StoreShape = {
  nextId: number;
  open: CandidatureOpen[];
  closed: CandidatureClosed[];
};

export async function loadCandStore(): Promise<StoreShape> {
  return readJson<StoreShape>(STORE, { nextId: 1, open: [], closed: [] });
}
export async function saveCandStore(s: StoreShape) {
  await writeJson(STORE, s);
}
export function makeJumpLink(gid: string, cid: string, mid: string) {
  return `https://discord.com/channels/${gid}/${cid}/${mid}`;
}
