/**
 * Speech-to-Text lokal memakai Whisper (ONNX via transformers.js).
 * Berjalan sepenuhnya di server — tanpa API/LLM eksternal. Model diunduh sekali lalu di-cache.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { env, pipeline, Tensor } from '@huggingface/transformers';
import { getFfmpegPath } from './tools.ts';

export const WHISPER_MODEL = process.env.WHISPER_MODEL || 'onnx-community/whisper-small';
const SAMPLE_RATE = 16000;

env.cacheDir = process.env.MODELS_DIR || path.join(process.cwd(), 'models');
env.allowRemoteModels = process.env.WHISPER_OFFLINE !== 'true';

type Transcriber = ((audio: Float32Array, options: Record<string, unknown>) => Promise<any>) & {
  model: any;
  processor: any;
};

let transcriberPromise: Promise<Transcriber> | null = null;
let loadListeners: Array<(fraction: number, message: string) => void> = [];

/** Muat model Whisper (sekali). Progress unduhan model diteruskan ke listener yang sedang menunggu. */
export function loadWhisper(onProgress?: (fraction: number, message: string) => void): Promise<Transcriber> {
  if (onProgress) loadListeners.push(onProgress);
  if (!transcriberPromise) {
    const fileProgress = new Map<string, { loaded: number; total: number }>();
    transcriberPromise = pipeline('automatic-speech-recognition', WHISPER_MODEL, {
      device: 'cpu',
      dtype: {
        encoder_model: (process.env.WHISPER_ENCODER_DTYPE || 'fp32') as any,
        decoder_model_merged: (process.env.WHISPER_DECODER_DTYPE || 'q8') as any,
      },
      progress_callback: (p: any) => {
        if (p.status !== 'progress' || !p.total) return;
        fileProgress.set(p.file, { loaded: p.loaded, total: p.total });
        let loaded = 0;
        let total = 0;
        for (const f of fileProgress.values()) {
          loaded += f.loaded;
          total += f.total;
        }
        if (!total) return;
        const mb = (n: number) => (n / 1024 / 1024).toFixed(0);
        loadListeners.forEach((cb) =>
          cb(loaded / total, `Mengunduh model Whisper (sekali saja)... ${mb(loaded)}/${mb(total)} MB`)
        );
      },
    }).then(
      (t) => {
        loadListeners = [];
        return t as unknown as Transcriber;
      },
      (err) => {
        transcriberPromise = null;
        loadListeners = [];
        throw new Error(`Gagal memuat model Whisper "${WHISPER_MODEL}": ${err.message}`);
      }
    );
  }
  return transcriberPromise;
}

const LANGUAGE_NAMES: Record<string, string> = {
  id: 'Bahasa Indonesia', en: 'English', ms: 'Bahasa Melayu', jw: 'Bahasa Jawa', su: 'Bahasa Sunda',
  ar: 'العربية', zh: '中文', ja: '日本語', ko: '한국어', hi: 'हिन्दी', es: 'Español', fr: 'Français',
  de: 'Deutsch', pt: 'Português', ru: 'Русский', th: 'ไทย', vi: 'Tiếng Việt', tl: 'Tagalog', nl: 'Nederlands', tr: 'Türkçe',
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] || code;
}

/**
 * Deteksi bahasa ucapan: satu langkah decoder Whisper pada 30 detik audio,
 * lalu ambil token bahasa dengan skor tertinggi (kode ISO, mis. "id").
 */
export async function detectLanguage(filePath: string, startSeconds = 0): Promise<string> {
  const transcriber = await loadWhisper();
  const audio = await decodePcm(filePath, startSeconds, 30);
  if (audio.length < SAMPLE_RATE) return 'en';

  const { input_features } = await transcriber.processor(audio);
  const config = transcriber.model.generation_config;
  const decoderInput = new Tensor('int64', BigInt64Array.from([BigInt(config.decoder_start_token_id)]), [1, 1]);
  const { logits } = await transcriber.model({ input_features, decoder_input_ids: decoderInput });

  let best = 'en';
  let bestScore = -Infinity;
  for (const [token, id] of Object.entries(config.lang_to_id as Record<string, number>)) {
    const score = logits.data[id];
    if (score > bestScore) {
      bestScore = score;
      best = token.replace(/^<\|(.+)\|>$/, '$1');
    }
  }
  return best;
}

/**
 * Baca WAV PCM s16le mono 16 kHz langsung dari disk (tanpa ffmpeg) dan ubah ke float32.
 * Mengembalikan null bila format WAV tidak sesuai, agar pemanggil memakai jalur ffmpeg.
 */
async function readWavPcm(filePath: string, startSeconds = 0, lengthSeconds = 0): Promise<Float32Array | null> {
  const fh = await fs.promises.open(filePath, 'r');
  try {
    const header = Buffer.alloc(4096);
    const { bytesRead } = await fh.read(header, 0, header.length, 0);
    if (bytesRead < 44 || header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WAVE') {
      return null;
    }
    // Cari chunk "fmt " dan "data"
    let pos = 12;
    let dataOffset = -1;
    let dataSize = 0;
    let fmtOk = false;
    while (pos + 8 <= bytesRead) {
      const id = header.toString('ascii', pos, pos + 4);
      const size = header.readUInt32LE(pos + 4);
      if (id === 'fmt ') {
        const format = header.readUInt16LE(pos + 8);
        const channels = header.readUInt16LE(pos + 10);
        const rate = header.readUInt32LE(pos + 12);
        const bits = header.readUInt16LE(pos + 22);
        fmtOk = format === 1 && channels === 1 && rate === SAMPLE_RATE && bits === 16;
      } else if (id === 'data') {
        dataOffset = pos + 8;
        dataSize = size;
        break;
      }
      pos += 8 + size + (size % 2);
    }
    if (!fmtOk || dataOffset < 0) return null;

    const fileSize = (await fh.stat()).size;
    const available = Math.min(dataSize || Infinity, fileSize - dataOffset);
    const startByte = Math.min(available, Math.floor(startSeconds * SAMPLE_RATE) * 2);
    const lengthBytes = lengthSeconds > 0 ? Math.min(available - startByte, Math.floor(lengthSeconds * SAMPLE_RATE) * 2) : available - startByte;
    const raw = Buffer.alloc(Math.max(0, lengthBytes - (lengthBytes % 2)));
    await fh.read(raw, 0, raw.length, dataOffset + startByte);

    const out = new Float32Array(raw.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = raw.readInt16LE(i * 2) / 32768;
    return out;
  } finally {
    await fh.close();
  }
}

/** Decode file audio menjadi PCM float32 mono 16 kHz (opsional hanya sebagian). */
async function decodePcm(filePath: string, startSeconds = 0, lengthSeconds = 0): Promise<Float32Array> {
  if (filePath.toLowerCase().endsWith('.wav')) {
    const pcm = await readWavPcm(filePath, startSeconds, lengthSeconds);
    if (pcm) return pcm;
  }
  const chunks: Buffer[] = [];
  const window = [
    ...(startSeconds > 0 ? ['-ss', String(startSeconds)] : []),
    ...(lengthSeconds > 0 ? ['-t', String(lengthSeconds)] : []),
  ];
  // runProcess mengumpulkan stdout sebagai string, jadi untuk data biner pakai spawn langsung
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      getFfmpegPath(),
      ['-hide_banner', '-loglevel', 'error', ...window, '-i', filePath, '-f', 'f32le', '-ac', '1', '-ar', String(SAMPLE_RATE), 'pipe:1'],
      { windowsHide: true }
    );
    let stderr = '';
    child.stdout.on('data', (c: Buffer) => chunks.push(c));
    child.stderr.on('data', (c: Buffer) => (stderr += c.toString()));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg exit ${code}`))));
  });
  const buf = Buffer.concat(chunks);
  // Salin ke ArrayBuffer baru agar alignment float32 terjamin
  const aligned = new ArrayBuffer(buf.length - (buf.length % 4));
  new Uint8Array(aligned).set(buf.subarray(0, aligned.byteLength));
  return new Float32Array(aligned);
}

export interface SttSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

/** Transkrip satu file audio (idealnya <= 10 menit). `language` = kode ISO. Timestamp relatif terhadap awal file. */
export async function transcribeAudioFile(
  filePath: string,
  language: string
): Promise<{ segments: SttSegment[]; durationSeconds: number }> {
  const transcriber = await loadWhisper();
  const audio = await decodePcm(filePath);
  const durationSeconds = audio.length / SAMPLE_RATE;

  const output = await transcriber(audio, {
    task: 'transcribe',
    language,
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
  });

  const rawChunks: any[] = output?.chunks ?? [];
  const segments = rawChunks
    .map((c) => {
      const [start, end] = c.timestamp ?? [];
      const s = Math.max(0, Number(start) || 0);
      const e = Number.isFinite(Number(end)) && end !== null ? Number(end) : Math.min(durationSeconds, s + 5);
      return { startSeconds: s, endSeconds: Math.max(s, Math.min(e, durationSeconds)), text: String(c.text || '').trim() };
    })
    .filter((s) => s.text && !/^\[.*\]$|^\(.*\)$/.test(s.text));

  return { segments: dedupeRepeats(segments), durationSeconds };
}

/** Whisper kadang "berhalusinasi" mengulang kalimat yang sama berturut-turut; buang duplikatnya. */
function dedupeRepeats(segments: SttSegment[]): SttSegment[] {
  const out: SttSegment[] = [];
  for (const seg of segments) {
    const prev = out[out.length - 1];
    if (prev && prev.text.toLowerCase() === seg.text.toLowerCase()) {
      prev.endSeconds = seg.endSeconds;
      continue;
    }
    out.push({ ...seg });
  }
  return out;
}
