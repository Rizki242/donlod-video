import fs from 'fs';
import path from 'path';
import { getFfmpegPath, runProcess } from './tools.ts';

function parseClock(value: string): number {
  const [h, m, s] = value.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

/** Durasi media dalam detik (dibaca dari output ffmpeg). 0 bila tidak terdeteksi. */
export async function probeDuration(filePath: string): Promise<number> {
  const result = await runProcess(getFfmpegPath(), ['-hide_banner', '-i', filePath]).catch((err) => err);
  const stderr: string = result?.stderr || '';
  const match = stderr.match(/Duration:\s*(\d+:\d+:\d+(?:\.\d+)?)/);
  return match ? parseClock(match[1]) : 0;
}

/**
 * Ekstrak audio dari video/audio apa pun menjadi MP3 mono 16 kHz — ukuran kecil
 * (~14 MB/jam) namun tetap jernih untuk pengenalan suara.
 */
export async function toSpeechAudio(
  inputPath: string,
  outputPath: string,
  durationSeconds: number,
  onProgress?: (fraction: number) => void
): Promise<void> {
  await runProcess(
    getFfmpegPath(),
    [
      '-hide_banner', '-y',
      '-i', inputPath,
      '-vn', '-sn', '-dn',
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'libmp3lame',
      '-b:a', '32k',
      '-progress', 'pipe:1',
      '-nostats',
      outputPath,
    ],
    {
      onStdoutLine: (line) => {
        const m = line.match(/^out_time_(?:us|ms)=(\d+)/);
        if (m && durationSeconds > 0) {
          onProgress?.(Math.min(1, Number(m[1]) / 1_000_000 / durationSeconds));
        }
      },
    }
  ).catch((err) => {
    if (/does not contain any stream|Output file #0 does not contain|matches no streams/i.test(err.message)) {
      throw new Error('File tidak memiliki track audio yang bisa ditranskrip.');
    }
    throw new Error(`Gagal mengekstrak audio: ${err.message}`);
  });
}

export interface AudioChunk {
  filePath: string;
  offsetSeconds: number;
  durationSeconds: number;
}

/** Potong audio menjadi beberapa bagian berdurasi `chunkSeconds` (tanpa re-encode). */
export async function splitAudio(
  inputPath: string,
  outDir: string,
  chunkSeconds: number
): Promise<AudioChunk[]> {
  await fs.promises.mkdir(outDir, { recursive: true });
  const listPath = path.join(outDir, 'chunks.csv');

  await runProcess(getFfmpegPath(), [
    '-hide_banner', '-y',
    '-i', inputPath,
    '-f', 'segment',
    '-segment_time', String(chunkSeconds),
    '-segment_list', listPath,
    '-segment_list_type', 'csv',
    '-c', 'copy',
    path.join(outDir, 'chunk_%03d.mp3'),
  ]);

  const csv = await fs.promises.readFile(listPath, 'utf8');
  return csv
    .split(/\r?\n/)
    .filter(Boolean)
    .map((row) => {
      const [name, start, end] = row.split(',');
      const offset = Number(start);
      return {
        filePath: path.join(outDir, name),
        offsetSeconds: offset,
        durationSeconds: Number(end) - offset,
      };
    })
    .filter((c) => c.durationSeconds > 0.5);
}
