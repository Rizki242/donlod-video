/**
 * Helper klien untuk job latar belakang di server (unduhan & transkripsi).
 */
import { TranscriptSegment } from '../types';
import { getSettings } from './settings';

/** Proxy & bahasa dari pengaturan pengguna, disertakan di setiap permintaan ke server. */
function netParams() {
  const { proxy, language } = getSettings();
  return { proxy: proxy.trim() || undefined, language };
}

export interface JobState<T = unknown> {
  id: string;
  kind: 'download' | 'transcribe';
  status: 'queued' | 'running' | 'done' | 'error';
  progress: number;
  message: string;
  error?: string;
  result?: T;
  hasFile: boolean;
  fileName?: string;
}

export interface TranscriptionResult {
  segments: TranscriptSegment[];
  fullText: string;
  detectedLanguage: string;
  languageCode: string;
  durationSeconds: number;
}

export type ProgressHandler = (progress: number, message: string) => void;

export async function postJson<T = any>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Permintaan gagal (HTTP ${res.status}).`);
  return data as T;
}

/** Polling status job sampai selesai. Melempar error bila job gagal. */
export async function waitForJob<T>(jobId: string, onProgress?: ProgressHandler): Promise<JobState<T>> {
  let failures = 0;
  for (;;) {
    let job: JobState<T>;
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const data = await res.json();
      if (!res.ok) throw Object.assign(new Error(data.error || 'Job tidak ditemukan.'), { fatal: res.status === 404 });
      job = data;
      failures = 0;
    } catch (err: any) {
      // Toleransi gangguan jaringan singkat
      if (err.fatal || ++failures > 5) throw err;
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    onProgress?.(job.progress, job.message);
    if (job.status === 'done') return job;
    if (job.status === 'error') throw new Error(job.error || 'Proses gagal.');
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** Upload multipart dengan progress (fetch belum mendukung progress upload). */
export function uploadWithProgress<T = any>(
  url: string,
  form: FormData,
  onProgress?: (fraction: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      const data = xhr.response || {};
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else reject(new Error(data.error || `Upload gagal (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Koneksi terputus saat mengunggah file.'));
    xhr.send(form);
  });
}

/** Mulai transkripsi dari URL video (server mengunduh audionya sendiri). */
export async function transcribeFromUrl(url: string, title: string, onProgress?: ProgressHandler) {
  const { jobId } = await postJson<{ jobId: string }>('/api/transcribe/url', { url, title, ...netParams() });
  const job = await waitForJob<TranscriptionResult>(jobId, onProgress);
  return job.result!;
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Upload file video/audio lalu transkrip di server.
 * Untuk video, track audionya diambil dulu di browser sehingga upload jauh lebih kecil.
 * Progress: 0-8 ambil audio, 8-25 upload, 25-100 transkripsi.
 */
export async function transcribeFromFile(file: File, onProgress?: ProgressHandler) {
  let uploadFile = file;
  if (!file.type.startsWith('audio/')) {
    onProgress?.(1, 'Mengambil track audio di browser...');
    const { extractAudioTrack } = await import('./audioTrack');
    const audioOnly = await extractAudioTrack(file, (f) =>
      onProgress?.(1 + Math.round(f * 7), `Mengambil track audio di browser... ${Math.round(f * 100)}%`)
    );
    if (audioOnly) uploadFile = audioOnly;
  }

  const form = new FormData();
  form.append('title', file.name.replace(/\.[^/.]+$/, ''));
  form.append('language', getSettings().language);
  form.append('file', uploadFile);

  const sizeNote =
    uploadFile !== file
      ? ` (hanya audio ${formatMb(uploadFile.size)} dari ${formatMb(file.size)})`
      : ` (${formatMb(file.size)})`;
  const startedAt = Date.now();
  const { jobId } = await uploadWithProgress<{ jobId: string }>('/api/transcribe/upload', form, (f) => {
    const elapsed = (Date.now() - startedAt) / 1000;
    const speed = elapsed > 0.5 ? ` • ${formatMb((uploadFile.size * f) / elapsed)}/s` : '';
    onProgress?.(8 + Math.round(f * 17), `Mengunggah${sizeNote}... ${Math.round(f * 100)}%${speed}`);
  });
  const job = await waitForJob<TranscriptionResult>(jobId, (p, msg) =>
    onProgress?.(25 + Math.round(p * 0.75), msg)
  );
  return job.result!;
}

/** Unduh video/audio lewat sistem pengunduh server, lalu simpan ke perangkat. */
/** Jalankan job unduhan di server sampai selesai (file tetap di server). */
export async function runDownloadJob(url: string, preset: string, onProgress?: ProgressHandler) {
  const { jobId } = await postJson<{ jobId: string }>('/api/download', { url, preset, ...netParams() });
  const job = await waitForJob<{ fileName: string; size: number }>(jobId, onProgress);
  return { jobId, job };
}

export async function downloadViaServer(url: string, preset: string, onProgress?: ProgressHandler) {
  const { jobId, job } = await runDownloadJob(url, preset, onProgress);

  const a = document.createElement('a');
  a.href = `/api/jobs/${jobId}/file`;
  a.download = job.fileName || '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return job.result!;
}

/** Ambil metadata video, format unduhan, dan subtitle bawaan. */
export function fetchVideoInfo(url: string) {
  return postJson('/api/video/info', { url, ...netParams() });
}
