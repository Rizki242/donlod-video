import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const require = createRequire(import.meta.url);

// Folder tempat binary pihak ketiga (yt-dlp) disimpan otomatis
export const BIN_DIR = process.env.BIN_DIR || path.join(process.cwd(), 'bin');

function ytDlpAssetName(): string {
  if (process.platform === 'win32') return 'yt-dlp.exe';
  if (process.platform === 'darwin') return 'yt-dlp_macos';
  if (process.arch === 'arm64') return 'yt-dlp_linux_aarch64';
  return 'yt-dlp_linux';
}

async function ensureYtDlp(): Promise<string> {
  const target = path.join(BIN_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  if (fs.existsSync(target)) return target;

  await fs.promises.mkdir(BIN_DIR, { recursive: true });
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytDlpAssetName()}`;
  console.log(`[tools] Mengunduh yt-dlp dari ${url} ...`);

  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Gagal mengunduh yt-dlp (HTTP ${res.status}).`);
  }
  const tmp = `${target}.part`;
  await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(tmp));
  await fs.promises.chmod(tmp, 0o755);
  await fs.promises.rename(tmp, target);
  console.log(`[tools] yt-dlp siap: ${target}`);
  return target;
}

let ytDlpPromise: Promise<string> | null = null;

/** Path ke binary yt-dlp. Diunduh otomatis saat pertama kali dibutuhkan. */
export function getYtDlpPath(): Promise<string> {
  if (process.env.YTDLP_PATH) return Promise.resolve(process.env.YTDLP_PATH);
  ytDlpPromise ??= ensureYtDlp().catch((err) => {
    ytDlpPromise = null;
    throw err;
  });
  return ytDlpPromise;
}

/** Path ke binary ffmpeg (dari paket ffmpeg-static, env FFMPEG_PATH, atau PATH sistem). */
export function getFfmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const staticPath: string | null = require('ffmpeg-static');
    if (staticPath && fs.existsSync(staticPath)) return staticPath;
  } catch {
    // paket tidak tersedia, pakai ffmpeg dari PATH
  }
  return 'ffmpeg';
}

export interface RunOptions {
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
  signal?: AbortSignal;
}

/** Menjalankan proses eksternal, resolve dengan stdout/stderr, reject bila exit code != 0. */
export function runProcess(
  command: string,
  args: string[],
  opts: RunOptions = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      signal: opts.signal,
    });

    let stdout = '';
    let stderr = '';
    let outBuf = '';
    let errBuf = '';

    const flushLines = (buf: string, cb?: (line: string) => void) => {
      const parts = buf.split(/\r?\n|\r/);
      const rest = parts.pop() ?? '';
      if (cb) parts.forEach((l) => l.trim() && cb(l));
      return rest;
    };

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stdout += text;
      outBuf = flushLines(outBuf + text, opts.onStdoutLine);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderr += text;
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
      errBuf = flushLines(errBuf + text, opts.onStderrLine);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (outBuf.trim()) opts.onStdoutLine?.(outBuf);
      if (errBuf.trim()) opts.onStderrLine?.(errBuf);
      if (code === 0) {
        resolve({ stdout, stderr, code: 0 });
      } else {
        const tail = stderr.trim().split(/\r?\n/).slice(-6).join('\n');
        const err: any = new Error(tail || `${path.basename(command)} keluar dengan kode ${code}`);
        err.code = code;
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      }
    });
  });
}
