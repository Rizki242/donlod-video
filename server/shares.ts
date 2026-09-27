/**
 * Halaman berbagi video: file disimpan permanen di SHARES_DIR/<id>/ bersama meta.json.
 * Setiap share punya ownerToken rahasia untuk mengubah/menghapusnya.
 */
import fs from 'fs';
import path from 'path';
import { randomBytes, timingSafeEqual } from 'crypto';
import type { TranscriptSegment } from './transcribe.ts';

export const SHARES_DIR = process.env.SHARES_DIR || path.join(process.cwd(), 'shares');
fs.mkdirSync(SHARES_DIR, { recursive: true });

const ID_PATTERN = /^[a-z0-9]{12}$/;

export interface ShareMeta {
  id: string;
  title: string;
  fileName: string;
  storedName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  durationSeconds?: number;
  language?: string;
  segments?: TranscriptSegment[];
  ownerToken: string;
}

const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.flac': 'audio/flac', '.aac': 'audio/aac',
};

export function mimeFromName(name: string, fallback = 'application/octet-stream'): string {
  return MIME_BY_EXT[path.extname(name).toLowerCase()] || fallback;
}

function newId(): string {
  // 12 karakter a-z0-9 (mis. "mlnw6cchcvii")
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function shareDir(id: string): string {
  if (!ID_PATTERN.test(id)) throw Object.assign(new Error('ID tidak valid.'), { status: 404 });
  return path.join(SHARES_DIR, id);
}

async function writeMeta(meta: ShareMeta) {
  const file = path.join(shareDir(meta.id), 'meta.json');
  await fs.promises.writeFile(`${file}.tmp`, JSON.stringify(meta));
  await fs.promises.rename(`${file}.tmp`, file);
}

/** Pindahkan file ke penyimpanan permanen dan buat share baru. */
export async function createShare(input: {
  sourcePath: string;
  fileName: string;
  title?: string;
  mimeType?: string;
  segments?: TranscriptSegment[];
  durationSeconds?: number;
  language?: string;
}): Promise<ShareMeta> {
  const id = newId();
  const dir = path.join(SHARES_DIR, id);
  await fs.promises.mkdir(dir, { recursive: true });

  const ext = path.extname(input.fileName).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin';
  const storedName = `media${ext}`;
  const target = path.join(dir, storedName);
  await fs.promises.rename(input.sourcePath, target).catch(async () => {
    // Beda drive/partisi: salin lalu hapus sumber
    await fs.promises.copyFile(input.sourcePath, target);
    await fs.promises.rm(input.sourcePath, { force: true });
  });

  const meta: ShareMeta = {
    id,
    title: (input.title || input.fileName.replace(/\.[^/.]+$/, '')).slice(0, 200),
    fileName: input.fileName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').slice(0, 200) || storedName,
    storedName,
    mimeType: input.mimeType && input.mimeType !== 'application/octet-stream' ? input.mimeType : mimeFromName(input.fileName),
    size: (await fs.promises.stat(target)).size,
    createdAt: new Date().toISOString(),
    durationSeconds: input.durationSeconds,
    language: input.language,
    segments: input.segments?.length ? input.segments : undefined,
    ownerToken: randomBytes(24).toString('hex'),
  };
  await writeMeta(meta);
  return meta;
}

export async function getShare(id: string): Promise<ShareMeta | null> {
  try {
    const raw = await fs.promises.readFile(path.join(shareDir(id), 'meta.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function shareFilePath(meta: ShareMeta): string {
  return path.join(shareDir(meta.id), meta.storedName);
}

export function isOwner(meta: ShareMeta, token: unknown): boolean {
  if (typeof token !== 'string' || token.length !== meta.ownerToken.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(meta.ownerToken));
}

export async function updateShare(meta: ShareMeta, patch: Partial<Pick<ShareMeta, 'title' | 'segments' | 'durationSeconds' | 'language'>>) {
  const next = { ...meta, ...patch };
  await writeMeta(next);
  return next;
}

export async function deleteShare(meta: ShareMeta) {
  await fs.promises.rm(shareDir(meta.id), { recursive: true, force: true });
}

/** Data yang aman ditampilkan ke publik (tanpa ownerToken). */
export function publicShare(meta: ShareMeta) {
  const { ownerToken: _token, storedName: _stored, ...rest } = meta;
  return {
    ...rest,
    streamUrl: `/api/shares/${meta.id}/stream`,
    downloadUrl: `/api/shares/${meta.id}/download`,
    pageUrl: `/d/${meta.id}`,
  };
}
