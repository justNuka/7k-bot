import fs from 'node:fs/promises';
import path from 'node:path';

export async function readChangelogSection(version: string): Promise<{title: string, body: string} | null> {
  const file = path.resolve(process.cwd(), 'src/data/CHANGELOG.md');
  let text = '';
  try {
    text = await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }

  // format attendu : "## 1.2.3 - 2025-10-30" puis lignes jusqu'au prochain "## "
  const rx = new RegExp(`^##\\s+${escapeRx(version)}[\\s\\S]*?(?=^##\\s+|\\Z)`, 'm');
  const m = text.match(rx);
  if (!m) return null;

  const section = m[0].trim();
  const [firstLine, ...rest] = section.split('\n');
  const title = firstLine.replace(/^##\s+/, '').trim();
  const body = rest.join('\n').trim() || '(pas de détails)';
  return { title, body };
}

function escapeRx(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
