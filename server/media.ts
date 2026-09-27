import fs from 'fs';
import os from 'os';
import path from 'path';
import { getFfmpegPath, runProcess } from './tools.ts';

// Jumlah proses ffmpeg paralel saat mengekstrak audio (decoder audio umumnya single-thread)
const EXTRACT_CONCURRENCY = Number(process.env.EXTRACT_CONCURRENCY || Math.max(2, Math.min(8, os.cpus().length)));

function parseClock(value: string): number {
  const [h, m, s] = value.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

/** Durasi media dalam detik (dibaca dari output ffmpeg). 0 bila tidak terdeteksi. */
export async function probeDuration(filePath: string): Promise<number> {
  const result = await runProcess(getFfmpegPath(), ['-hide_banner', '-nostdin', '-i', filePath]).catch((err) => err);
  const stderr: string = result?.stderr || '';
  const match = stderr.match(/Duration:\s*(\d+:\d+:\d+(?:\.\d+)?)/);
  return match ? parseClock(match[1]) : 0;
}

function friendlyExtractError(err: any): Error {
  if (/does not contain any stream|Output file #0 does not contain|matches no streams|Output file does not contain/i.test(err.message)) {
    return new Error('File tidak memiliki track audio yang bisa ditranskrip.');
  }
  return new Error(`Gagal mengekstrak audio: ${err.message}`);
}

/**
 * Argumen ffmpeg: ambil hanya stream audio pertama (video tidak didecode sama sekali)
 * lalu tulis WAV PCM mono 16 kHz — tanpa proses encoding, jadi jauh lebih cepat dari MP3.
 */
function speechArgs(inputPath: string, outputPath: string, window?: { start: number; length: number }) {
  return [
    '-hide_banner', '-nostdin', '-y',
    '-loglevel', 'error',
    // -ss sebelum -i = seek cepat langsung ke posisi (tanpa mendecode bagian sebelumnya)
    ...(window ? ['-ss', String(window.start), '-t', String(window.length)] : []),
    '-i', inputPath,
    '-map', '0:a:0',
    '-vn', '-sn', '-dn',
    '-ac', '1',
    '-ar', '16000',
    '-c:a', 'pcm_s16le',
    '-bitexact',
    outputPath,
  ];
}

/** Ekstrak seluruh audio menjadi satu WAV 16 kHz (dipakai bila durasi tidak diketahui). */
export async function toSpeechAudio(inputPath: string, outputPath: string): Promise<void> {
  await runProcess(getFfmpegPath(), speechArgs(inputPath, outputPath)).catch((err) => {
    throw friendlyExtractError(err);
  });
}

export interface AudioChunk {
  filePath: string;
  offsetSeconds: number;
  durationSeconds: number;
}

/**
 * Ekstrak audio langsung per potongan `chunkSeconds` secara PARALEL (satu ffmpeg per potongan).
 * Hasilnya WAV siap dibaca Whisper; tidak perlu tahap encode MP3 maupun pemotongan terpisah.
 */
export async function extractSpeechChunks(
  inputPath: string,
  outDir: string,
  durationSeconds: number,
  chunkSeconds: number,
  onProgress?: (fraction: number) => void
): Promise<AudioChunk[]> {
  await fs.promises.mkdir(outDir, { recursive: true });

  const count = Math.max(1, Math.ceil(durationSeconds / chunkSeconds));
  const chunks: AudioChunk[] = Array.from({ length: count }, (_, i) => {
    const offset = i * chunkSeconds;
    return {
      filePath: path.join(outDir, `chunk_${String(i).padStart(3, '0')}.wav`),
      offsetSeconds: offset,
      durationSeconds: Math.min(chunkSeconds, durationSeconds - offset),
    };
  });

  let done = 0;
  let next = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const chunk = chunks[next++];
      // Potongan terakhir tanpa -t agar sisa audio tidak terpotong bila durasi sedikit meleset
      const isLast = chunk === chunks[chunks.length - 1];
      await runProcess(
        getFfmpegPath(),
        speechArgs(inputPath, chunk.filePath, {
          start: chunk.offsetSeconds,
          length: isLast ? chunk.durationSeconds + 60 : chunk.durationSeconds,
        })
      ).catch((err) => {
        throw friendlyExtractError(err);
      });
      done++;
      onProgress?.(done / chunks.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(EXTRACT_CONCURRENCY, chunks.length) }, worker));

  // Durasi sebenarnya dihitung dari ukuran data PCM (2 byte per sampel, 16 kHz)
  for (const chunk of chunks) {
    const size = (await fs.promises.stat(chunk.filePath)).size;
    chunk.durationSeconds = Math.max(0, (size - 44) / 32000);
  }
  return chunks.filter((c) => c.durationSeconds > 0.5);
}
