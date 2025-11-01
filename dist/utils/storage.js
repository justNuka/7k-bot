import { promises as fs } from 'node:fs';
import path from 'node:path';
export async function readJson(relPath, fallback) {
    const abs = path.resolve(process.cwd(), relPath);
    try {
        const buf = await fs.readFile(abs, 'utf8');
        return JSON.parse(buf);
    }
    catch {
        return fallback;
    }
}
export async function writeJson(relPath, data) {
    const abs = path.resolve(process.cwd(), relPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, JSON.stringify(data, null, 2), 'utf8');
}
