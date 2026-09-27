import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

export const WORK_ROOT = process.env.WORK_DIR || path.join(os.tmpdir(), 'videoscribe');

const JOB_TTL_MS = Number(process.env.JOB_TTL_MINUTES || 60) * 60_000;
const MAX_CONCURRENT_JOBS = Number(process.env.MAX_CONCURRENT_JOBS || 3);

export type JobKind = 'download' | 'transcribe';
export type JobStatus = 'queued' | 'running' | 'done' | 'error';

export interface Job {
  id: string;
  kind: JobKind;
  status: JobStatus;
  progress: number;
  message: string;
  error?: string;
  result?: unknown;
  filePath?: string;
  fileName?: string;
  workDir: string;
  createdAt: number;
  updatedAt: number;
}

export interface JobContext {
  job: Job;
  update: (progress: number, message?: string) => void;
}

const jobs = new Map<string, Job>();
const queue: Array<() => void> = [];
let running = 0;

function acquireSlot(): Promise<void> {
  if (running < MAX_CONCURRENT_JOBS) {
    running++;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(() => {
    running++;
    resolve();
  }));
}

function releaseSlot() {
  running--;
  queue.shift()?.();
}

/** Membuat job latar belakang. `run` mengisi job.result / job.filePath saat selesai. */
export function createJob(kind: JobKind, run: (ctx: JobContext) => Promise<void>): Job {
  const id = randomUUID();
  const workDir = path.join(WORK_ROOT, id);
  fs.mkdirSync(workDir, { recursive: true });

  const job: Job = {
    id,
    kind,
    status: 'queued',
    progress: 0,
    message: 'Menunggu antrean...',
    workDir,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobs.set(id, job);

  const update = (progress: number, message?: string) => {
    job.progress = Math.max(0, Math.min(100, Math.round(progress)));
    if (message) job.message = message;
    job.updatedAt = Date.now();
  };

  (async () => {
    await acquireSlot();
    job.status = 'running';
    try {
      await run({ job, update });
      job.status = 'done';
      update(100, job.message || 'Selesai');
    } catch (err: any) {
      console.error(`[job ${id}] gagal:`, err);
      job.status = 'error';
      job.error = err?.message || 'Terjadi kesalahan tak terduga.';
      job.updatedAt = Date.now();
    } finally {
      releaseSlot();
    }
  })();

  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function publicJob(job: Job) {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    progress: job.progress,
    message: job.message,
    error: job.error,
    result: job.status === 'done' ? job.result : undefined,
    hasFile: job.status === 'done' && !!job.filePath,
    fileName: job.fileName,
  };
}

function removeJob(job: Job) {
  jobs.delete(job.id);
  fs.rm(job.workDir, { recursive: true, force: true }, () => {});
}

// Bersihkan job lama beserta file sementaranya
setInterval(() => {
  const now = Date.now();
  for (const job of jobs.values()) {
    if ((job.status === 'done' || job.status === 'error') && now - job.updatedAt > JOB_TTL_MS) {
      removeJob(job);
    }
  }
}, 5 * 60_000).unref();

// Hapus sisa folder kerja dari proses sebelumnya
try {
  fs.rmSync(WORK_ROOT, { recursive: true, force: true });
} catch {
  // folder sedang dipakai proses lain, abaikan
}
export const UPLOAD_DIR = path.join(WORK_ROOT, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
