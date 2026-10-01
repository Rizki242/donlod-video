/**
 * Halaman berbagi video: file disimpan permanen di SHARES_DIR/<id>/ bersama meta.json.
 * Setiap share punya ownerToken rahasia untuk mengubah/menghapusnya.
 */
import fs from 'fs';
import path from 'path';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
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
  /** SHA-256 dari token pemilik; token asli hanya dikirim sekali saat share dibuat. */
  ownerTokenHash?: string;
  /** Hanya untuk share lama yang dibuat sebelum token di-hash. */
  ownerToken?: string;
}

const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.flac': 'audio/flac', '.aac': 'audio/aac',
  '.avi': 'video/x-msvideo', '.wmv': 'video/x-ms-wmv', '.flv': 'video/x-flv', '.3gp': 'video/3gpp',
  '.mpeg': 'video/mpeg', '.mpg': 'video/mpeg', '.ts': 'video/mp2t', '.wma': 'audio/x-ms-wma', '.amr': 'audio/amr',
};

/** MIME hanya ditentukan dari ekstensi yang diizinkan, tidak pernah dari input klien (mencegah XSS lewat text/html). */
export function mimeFromName(name: string): string {
  return MIME_BY_EXT[path.extname(name).toLowerCase()] || 'application/octet-stream';
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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
  segments?: TranscriptSegment[];
  durationSeconds?: number;
  language?: string;
}): Promise<ShareMeta & { ownerToken: string }> {
  const id = newId();
  const dir = path.join(SHARES_DIR, id);
  await fs.promises.mkdir(dir, { recursive: true });

  // Ekstensi di luar daftar putih disimpan sebagai .bin agar tidak pernah disajikan sebagai HTML/skrip
  const rawExt = path.extname(input.fileName).toLowerCase();
  const ext = rawExt in MIME_BY_EXT ? rawExt : '.bin';
  const storedName = `media${ext}`;
  const target = path.join(dir, storedName);
  await fs.promises.rename(input.sourcePath, target).catch(async () => {
    // Beda drive/partisi: salin lalu hapus sumber
    await fs.promises.copyFile(input.sourcePath, target);
    await fs.promises.rm(input.sourcePath, { force: true });
  });

  const ownerToken = randomBytes(24).toString('hex');
  const meta: ShareMeta = {
    id,
    title: (input.title || input.fileName.replace(/\.[^/.]+$/, '')).slice(0, 200),
    fileName: input.fileName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').slice(0, 200) || storedName,
    storedName,
    mimeType: mimeFromName(storedName),
    size: (await fs.promises.stat(target)).size,
    createdAt: new Date().toISOString(),
    durationSeconds: input.durationSeconds,
    language: input.language,
    segments: input.segments?.length ? input.segments : undefined,
    ownerTokenHash: hashToken(ownerToken),
  };
  await writeMeta(meta);
  return { ...meta, ownerToken };
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
  if (typeof token !== 'string' || !token) return false;
  const expected = meta.ownerTokenHash ?? (meta.ownerToken ? hashToken(meta.ownerToken) : '');
  if (!expected) return false;
  return timingSafeEqual(Buffer.from(hashToken(token)), Buffer.from(expected));
}

const updateLocks = new Map<string, Promise<unknown>>();

/** Update diserialkan per share dan memakai meta terbaru dari disk, sehingga update bersamaan tidak saling menimpa. */
export function updateShare(meta: ShareMeta, patch: Partial<Pick<ShareMeta, 'title' | 'segments' | 'durationSeconds' | 'language'>>): Promise<ShareMeta> {
  const previous = updateLocks.get(meta.id) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(async () => {
    const latest = (await getShare(meta.id)) ?? meta;
    const next = { ...latest, ...patch };
    await writeMeta(next);
    return next;
  });
  const tail: Promise<unknown> = run.catch(() => {}).finally(() => {
    if (updateLocks.get(meta.id) === tail) updateLocks.delete(meta.id);
  });
  updateLocks.set(meta.id, tail);
  return run;
}

export async function deleteShare(meta: ShareMeta) {
  await fs.promises.rm(shareDir(meta.id), { recursive: true, force: true });
}

/** Data yang aman ditampilkan ke publik (tanpa token pemilik). */
export function publicShare(meta: ShareMeta) {
  const { ownerToken: _token, ownerTokenHash: _hash, storedName: _stored, ...rest } = meta;
  return {
    ...rest,
    streamUrl: `/api/shares/${meta.id}/stream`,
    downloadUrl: `/api/shares/${meta.id}/download`,
    pageUrl: `/d/${meta.id}`,
  };
}
