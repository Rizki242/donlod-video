import path from 'path';
import { probeDuration, splitAudio, toSpeechAudio } from './media.ts';
import { detectLanguage, languageName, loadWhisper, transcribeAudioFile } from './stt.ts';

export interface TranscriptSegment {
  id: number;
  start: string;
  end: string;
  startSeconds: number;
  endSeconds: number;
  speaker: string;
  text: string;
}

export interface TranscriptionResult {
  segments: TranscriptSegment[];
  fullText: string;
  detectedLanguage: string;
  languageCode: string;
  durationSeconds: number;
}

// Potongan 5 menit: progress lebih halus dan memori PCM kecil (~19 MB per potongan)
const CHUNK_SECONDS = Number(process.env.TRANSCRIBE_CHUNK_SECONDS || 300);
export const MAX_DURATION_SECONDS = Number(process.env.MAX_DURATION_MINUTES || 180) * 60;

export function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Pipeline lengkap (100% lokal): file media -> audio MP3 16 kHz -> dipotong per 5 menit
 * -> Whisper mentranskrip tiap potongan -> digabung dengan timestamp absolut.
 */
export async function transcribeMediaFile(
  inputPath: string,
  workDir: string,
  opts: { language?: string; onProgress?: (fraction: number, message: string) => void } = {}
): Promise<TranscriptionResult> {
  const { onProgress } = opts;

  onProgress?.(0, 'Membaca durasi media...');
  const sourceDuration = await probeDuration(inputPath);
  if (sourceDuration > MAX_DURATION_SECONDS) {
    throw new Error(
      `Durasi media ${formatTime(sourceDuration)} melebihi batas ${Math.round(MAX_DURATION_SECONDS / 60)} menit.`
    );
  }

  const speechPath = path.join(workDir, 'speech.mp3');
  onProgress?.(0.01, 'Mengekstrak audio dari media...');
  await toSpeechAudio(inputPath, speechPath, sourceDuration, (f) =>
    onProgress?.(0.01 + f * 0.07, 'Mengekstrak audio dari media...')
  );

  onProgress?.(0.08, 'Memuat mesin speech-to-text (Whisper)...');
  await loadWhisper((f, message) => onProgress?.(0.08 + f * 0.07, message));

  const duration = (await probeDuration(speechPath)) || sourceDuration;

  let language = (opts.language || 'auto').toLowerCase();
  if (language === 'auto') {
    onProgress?.(0.15, 'Mendeteksi bahasa ucapan...');
    // Lewati 30 detik awal (sering berisi intro musik) bila media cukup panjang
    language = await detectLanguage(speechPath, duration > 90 ? 30 : 0);
  }

  const chunks =
    duration > CHUNK_SECONDS * 1.2
      ? await splitAudio(speechPath, path.join(workDir, 'chunks'), CHUNK_SECONDS)
      : [{ filePath: speechPath, offsetSeconds: 0, durationSeconds: duration }];

  const all: Array<{ startSeconds: number; endSeconds: number; text: string }> = [];
  const startedAt = Date.now();
  for (let i = 0; i < chunks.length; i++) {
    const done = chunks.slice(0, i).reduce((sum, c) => sum + c.durationSeconds, 0);
    const elapsed = (Date.now() - startedAt) / 1000;
    const eta = i > 0 ? Math.round((elapsed / done) * (duration - done)) : 0;
    onProgress?.(
      0.16 + (done / duration) * 0.84,
      `Mengonversi suara ke teks (${languageName(language)})... ${formatTime(done)} / ${formatTime(duration)}` +
        (eta > 0 ? ` • sisa ±${formatTime(eta)}` : '')
    );

    const chunk = chunks[i];
    const result = await transcribeAudioFile(chunk.filePath, language);
    for (const s of result.segments) {
      all.push({
        startSeconds: Math.round((chunk.offsetSeconds + s.startSeconds) * 10) / 10,
        endSeconds: Math.round((chunk.offsetSeconds + s.endSeconds) * 10) / 10,
        text: s.text,
      });
    }
  }

  const segments: TranscriptSegment[] = all.map((s, i) => ({
    id: i + 1,
    start: formatTime(s.startSeconds),
    end: formatTime(s.endSeconds),
    startSeconds: s.startSeconds,
    endSeconds: s.endSeconds,
    speaker: 'Pembicara',
    text: s.text,
  }));

  return {
    segments,
    fullText: segments.map((s) => s.text).join(' '),
    detectedLanguage: languageName(language),
    languageCode: language,
    durationSeconds: Math.round(duration),
  };
}
