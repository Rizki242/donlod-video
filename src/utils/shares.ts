/**
 * Klien untuk halaman berbagi video (/d/:id).
 * Token pemilik disimpan di browser agar pembuat bisa mengubah/menghapus videonya.
 */
import { TranscriptSegment } from '../types';
import { postJson, uploadWithProgress, runDownloadJob, waitForJob, ProgressHandler, TranscriptionResult } from './jobs';
import { getSettings } from './settings';

export interface ShareInfo {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  durationSeconds?: number;
  language?: string;
  segments?: TranscriptSegment[];
  streamUrl: string;
  downloadUrl: string;
  pageUrl: string;
  isOwner?: boolean;
  ownerToken?: string;
}

interface OwnedShare {
  id: string;
  title: string;
  token: string;
  createdAt: string;
}

const STORAGE_KEY = 'videoscribe-my-shares';

export function getMyShares(): OwnedShare[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeMyShares(list: OwnedShare[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // storage diblokir: token hanya berlaku selama sesi ini
  }
}

function rememberShare(share: ShareInfo) {
  if (!share.ownerToken) return;
  const list = getMyShares().filter((s) => s.id !== share.id);
  list.unshift({ id: share.id, title: share.title, token: share.ownerToken, createdAt: share.createdAt });
  writeMyShares(list.slice(0, 100));
}

export function forgetShare(id: string) {
  writeMyShares(getMyShares().filter((s) => s.id !== id));
}

export function ownerToken(id: string): string | undefined {
  return getMyShares().find((s) => s.id === id)?.token;
}

export function shareLink(id: string): string {
  return `${window.location.origin}/d/${id}`;
}

function ownerHeaders(id: string): Record<string, string> {
  const token = ownerToken(id);
  return token ? { 'x-owner-token': token } : {};
}

/** Upload file video milik sendiri lalu buat halaman berbagi. Progress 0-100. */
export async function createShareFromFile(
  file: File,
  opts: { title?: string; segments?: TranscriptSegment[]; durationSeconds?: number; language?: string } = {},
  onProgress?: ProgressHandler
): Promise<ShareInfo> {
  const form = new FormData();
  form.append('title', opts.title || file.name.replace(/\.[^/.]+$/, ''));
  if (opts.segments?.length) form.append('segments', JSON.stringify(opts.segments));
  if (opts.durationSeconds) form.append('durationSeconds', String(opts.durationSeconds));
  if (opts.language) form.append('language', opts.language);
  form.append('file', file);

  const share = await uploadWithProgress<ShareInfo>('/api/shares', form, (f) =>
    onProgress?.(Math.round(f * 100), `Mengunggah video... ${Math.round(f * 100)}%`)
  );
  rememberShare(share);
  return share;
}

/** Unduh video dari URL di server lalu jadikan halaman berbagi (tanpa lewat browser). */
export async function createShareFromUrl(
  url: string,
  preset: string,
  opts: { title?: string; segments?: TranscriptSegment[]; durationSeconds?: number; language?: string } = {},
  onProgress?: ProgressHandler
): Promise<ShareInfo> {
  const { jobId } = await runDownloadJob(url, preset, (p, msg) => onProgress?.(Math.round(p * 0.95), msg));
  onProgress?.(97, 'Menyimpan ke halaman berbagi...');
  const share = await postJson<ShareInfo>('/api/shares/from-job', { jobId, ...opts });
  rememberShare(share);
  return share;
}

export async function fetchShare(id: string): Promise<ShareInfo> {
  const res = await fetch(`/api/shares/${id}`, { headers: ownerHeaders(id) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Video tidak ditemukan.');
  return data;
}

export async function deleteShare(id: string) {
  const res = await fetch(`/api/shares/${id}`, { method: 'DELETE', headers: ownerHeaders(id) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Gagal menghapus video.');
  forgetShare(id);
}

export async function renameShare(id: string, title: string): Promise<ShareInfo> {
  const res = await fetch(`/api/shares/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...ownerHeaders(id) },
    body: JSON.stringify({ title }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Gagal mengubah judul.');
  const list = getMyShares().map((s) => (s.id === id ? { ...s, title: data.title } : s));
  writeMyShares(list);
  return data;
}

/** Pemilik membuat transkrip untuk video yang dibagikan (Whisper lokal di server). */
export async function transcribeShare(id: string, onProgress?: ProgressHandler) {
  const res = await fetch(`/api/shares/${id}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...ownerHeaders(id) },
    body: JSON.stringify({ language: getSettings().language }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Gagal memulai transkripsi.');
  const job = await waitForJob<TranscriptionResult>(data.jobId, onProgress);
  return job.result!;
}
