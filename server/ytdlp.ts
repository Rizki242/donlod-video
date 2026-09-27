import fs from 'fs';
import path from 'path';
import { getFfmpegPath, getYtDlpPath, runProcess } from './tools.ts';

const VIDEO_HEIGHTS = [2160, 1440, 1080, 720, 480, 360] as const;

export interface YtFormat {
  format_id: string;
  ext: string;
  height?: number | null;
  vcodec?: string;
  acodec?: string;
  abr?: number | null;
  tbr?: number | null;
  filesize?: number | null;
  filesize_approx?: number | null;
}

export interface YtInfo {
  id: string;
  title: string;
  uploader?: string;
  channel?: string;
  thumbnail?: string;
  duration?: number;
  webpage_url?: string;
  extractor_key?: string;
  formats?: YtFormat[];
  subtitles?: Record<string, Array<{ ext: string; url?: string; name?: string }>>;
  automatic_captions?: Record<string, Array<{ ext: string; url?: string; name?: string }>>;
}

/** Opsi jaringan per permintaan (proxy/VPN). */
export interface NetOptions {
  proxy?: string;
}

/**
 * Proxy yang dipakai: dari permintaan (diisi pengguna di UI) atau default dari env PROXY_URL.
 * Mendukung http://, https://, socks4://, socks5://, socks5h:// (mis. proxy lokal dari aplikasi VPN).
 */
export function resolveProxy(requested?: unknown): string | undefined {
  const value = (typeof requested === 'string' && requested.trim()) || process.env.PROXY_URL || '';
  if (!value || value === 'none') return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw Object.assign(new Error('Alamat proxy tidak valid. Contoh: socks5://127.0.0.1:1080'), { status: 400 });
  }
  if (!['http:', 'https:', 'socks4:', 'socks4a:', 'socks5:', 'socks5h:'].includes(parsed.protocol)) {
    throw Object.assign(new Error('Proxy harus diawali http://, https://, socks4:// atau socks5://'), { status: 400 });
  }
  return value;
}

export interface DownloadOption {
  label: string;
  resolution: string;
  format: string;
  quality: string;
  sizeEstimate?: string;
  type: 'video' | 'audio';
  preset: string;
  actionType: 'server';
}

function baseArgs(net: NetOptions = {}): string[] {
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--no-color',
    // yt-dlp butuh JS runtime untuk YouTube; pakai Node yang sedang menjalankan server
    '--js-runtimes', `node:${process.execPath}`,
    '--ffmpeg-location', getFfmpegPath(),
    '--socket-timeout', '30',
    '--retries', '5',
  ];
  if (net.proxy) args.push('--proxy', net.proxy);
  // File cookies (format Netscape) untuk situs yang butuh login
  if (process.env.YTDLP_COOKIES_FILE && fs.existsSync(process.env.YTDLP_COOKIES_FILE)) {
    args.push('--cookies', process.env.YTDLP_COOKIES_FILE);
  }
  return args;
}

export async function getVideoInfo(url: string, net: NetOptions = {}): Promise<YtInfo> {
  const bin = await getYtDlpPath();
  const { stdout } = await runProcess(bin, [...baseArgs(net), '-J', '--skip-download', url]).catch((err) => {
    throw new Error(friendlyYtError(err.message));
  });
  return JSON.parse(stdout);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${Math.max(0.1, bytes / 1024 ** 2).toFixed(1)} MB`;
}

function formatSize(f: YtFormat, duration?: number): number {
  if (f.filesize) return f.filesize;
  if (f.filesize_approx) return f.filesize_approx;
  if (f.tbr && duration) return (f.tbr * 1000 * duration) / 8;
  return 0;
}

/** Susun daftar opsi unduhan berdasarkan format yang benar-benar tersedia di sumber. */
export function buildDownloadOptions(info: YtInfo | null): DownloadOption[] {
  const formats = info?.formats ?? [];
  const duration = info?.duration;
  const videoFormats = formats.filter((f) => f.vcodec && f.vcodec !== 'none' && f.height);
  const audioFormats = formats.filter((f) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'));
  const bestAudioSize = Math.max(0, ...audioFormats.map((f) => formatSize(f, duration)));

  const options: DownloadOption[] = [];

  const hasVideo = formats.length === 0 || formats.some((f) => f.vcodec !== 'none');

  if (hasVideo && info && videoFormats.length === 0) {
    // Resolusi tidak diketahui (mis. link file langsung): tawarkan file asli saja
    const size = Math.max(0, ...formats.map((f) => formatSize(f, duration)));
    options.push({
      label: 'Video (Kualitas Asli)',
      resolution: 'Sesuai sumber',
      format: 'mp4',
      quality: 'Original',
      sizeEstimate: size ? `~${formatBytes(size)}` : undefined,
      type: 'video',
      preset: 'video-best',
      actionType: 'server',
    });
  } else if (hasVideo) {
    const maxHeight = videoFormats.length ? Math.max(...videoFormats.map((f) => f.height!)) : 1080;
    const heights = VIDEO_HEIGHTS.filter((h) => h <= Math.max(maxHeight, 360));
    for (const h of heights) {
      // Ukuran perkiraan = video terbesar pada tinggi <= h + audio terbaik
      const candidates = videoFormats.filter((f) => f.height! <= h && f.height! > h * 0.6);
      const videoSize = Math.max(0, ...candidates.map((f) => formatSize(f, duration)));
      const total = videoSize ? videoSize + bestAudioSize : 0;
      const labelName = h >= 2160 ? '4K' : h >= 1440 ? '2K' : h >= 1080 ? 'Full HD' : h >= 720 ? 'HD' : 'SD';
      options.push({
        label: `Video MP4 ${h}p (${labelName})`,
        resolution: `${h}p`,
        format: 'mp4',
        quality: labelName,
        sizeEstimate: total ? `~${formatBytes(total)}` : undefined,
        type: 'video',
        preset: `video-${h}`,
        actionType: 'server',
      });
    }
  }

  options.push(
    {
      label: 'Audio MP3 (Kualitas Tinggi)',
      resolution: 'MP3 VBR ~245 kbps',
      format: 'mp3',
      quality: 'Audio Berkualitas Tinggi',
      sizeEstimate: duration ? `~${formatBytes((245_000 * duration) / 8)}` : undefined,
      type: 'audio',
      preset: 'audio-mp3',
      actionType: 'server',
    },
    {
      label: 'Audio M4A / AAC (Asli)',
      resolution: 'AAC dari sumber',
      format: 'm4a',
      quality: 'Tanpa konversi ulang',
      sizeEstimate: bestAudioSize ? `~${formatBytes(bestAudioSize)}` : undefined,
      type: 'audio',
      preset: 'audio-m4a',
      actionType: 'server',
    }
  );

  return options;
}

export function isValidPreset(preset: string): boolean {
  if (['audio-mp3', 'audio-m4a', 'audio-speech', 'video-best'].includes(preset)) return true;
  const m = preset.match(/^video-(\d+)$/);
  return !!m && (VIDEO_HEIGHTS as readonly number[]).includes(Number(m[1]));
}

function presetArgs(preset: string): string[] {
  if (preset === 'audio-mp3') {
    return ['-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0'];
  }
  if (preset === 'audio-m4a') {
    return ['-f', 'ba[ext=m4a]/ba/b', '-x', '--audio-format', 'm4a'];
  }
  if (preset === 'audio-speech') {
    // Audio terkecil yang masih layak untuk transkripsi; dikonversi ulang oleh ffmpeg setelahnya
    return ['-f', 'ba[abr<=160]/ba/b', '-S', '+abr'];
  }
  const height = preset === 'video-best' ? 0 : Number(preset.replace('video-', ''));
  return [
    '-f', 'bv*+ba/b',
    '-S', height ? `res:${height},vcodec:h264,acodec:m4a` : 'vcodec:h264,acodec:m4a',
    '--merge-output-format', 'mp4',
  ];
}

export interface DownloadResult {
  filePath: string;
  title: string;
}

/** Unduh media dengan yt-dlp ke `outDir`. Progress dilaporkan 0..1. */
export async function downloadMedia(
  url: string,
  preset: string,
  outDir: string,
  onProgress?: (fraction: number, message: string) => void,
  net: NetOptions = {}
): Promise<DownloadResult> {
  const bin = await getYtDlpPath();
  const isVideo = preset.startsWith('video-');
  let streamIndex = 0;
  let lastFraction = 0;

  const args = [
    ...baseArgs(net),
    ...presetArgs(preset),
    '--newline',
    '--progress',
    '--progress-template',
    'download:PROGRESS %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s',
    '--restrict-filenames',
    '--no-mtime',
    '-o', path.join(outDir, 'media.%(ext)s'),
    '--print', 'before_dl:TITLE %(title)s',
    '--print', 'after_move:FILEPATH %(filepath)s',
    url,
  ];

  let title = '';
  let finalPath = '';

  await runProcess(bin, args, {
    onStdoutLine: (line) => {
      if (line.startsWith('TITLE ')) {
        title = line.slice(6).trim();
        return;
      }
      if (line.startsWith('FILEPATH ')) {
        finalPath = line.slice(9).trim();
        return;
      }
      if (line.startsWith('PROGRESS ')) {
        const [, done, total, estimate] = line.split(' ');
        const totalBytes = Number(total) || Number(estimate);
        if (!totalBytes || !Number(done)) return;
        const fraction = Math.min(1, Number(done) / totalBytes);
        if (fraction + 0.2 < lastFraction) streamIndex++;
        lastFraction = fraction;

        if (isVideo) {
          // Stream pertama = video (bobot 85%), kedua = audio (15%)
          const overall = streamIndex === 0 ? fraction * 0.85 : 0.85 + fraction * 0.15;
          onProgress?.(overall, streamIndex === 0 ? 'Mengunduh stream video...' : 'Mengunduh stream audio...');
        } else {
          onProgress?.(fraction, 'Mengunduh audio...');
        }
      }
    },
    onStderrLine: (line) => {
      if (/\[Merger\]|\[ExtractAudio\]|\[VideoConvertor\]/.test(line)) {
        onProgress?.(0.99, isVideo ? 'Menggabungkan video & audio...' : 'Mengonversi audio...');
      }
    },
  }).catch((err) => {
    throw new Error(friendlyYtError(err.message));
  });

  if (!finalPath || !fs.existsSync(finalPath)) {
    // Fallback: cari file hasil di folder output
    const candidate = (await fs.promises.readdir(outDir)).find((f) => f.startsWith('media.') && !f.endsWith('.part'));
    if (!candidate) throw new Error('Unduhan selesai tetapi file hasil tidak ditemukan.');
    finalPath = path.join(outDir, candidate);
  }

  return { filePath: finalPath, title };
}

function friendlyYtError(message: string): string {
  const msg = message || '';
  if (/Unsupported URL/i.test(msg)) return 'Situs/tautan ini tidak didukung oleh sistem pengunduh.';
  if (/Private video|This video is private/i.test(msg)) return 'Video bersifat privat dan tidak dapat diakses.';
  if (/Sign in to confirm your age|age-restricted/i.test(msg)) return 'Video dibatasi usia dan memerlukan login.';
  if (/Sign in to confirm you.re not a bot/i.test(msg)) {
    return 'YouTube meminta verifikasi anti-bot dari server ini. Coba lagi nanti atau gunakan fitur upload file.';
  }
  if (/Video unavailable|not available/i.test(msg)) return 'Video tidak tersedia (dihapus atau dibatasi wilayah).';
  if (/HTTP Error 404/i.test(msg)) return 'Sumber media tidak ditemukan (404).';
  if (/HTTP Error 403/i.test(msg)) return 'Akses ke sumber media ditolak (403). Tautan mungkin kedaluwarsa atau diproteksi.';
  if (/is live|live event/i.test(msg)) return 'Siaran langsung (live) belum dapat diunduh.';
  if (/Unable to connect to proxy|ProxyError|SOCKS|proxy/i.test(msg)) {
    return 'Tidak bisa terhubung ke proxy/VPN. Pastikan aplikasi VPN aktif dan alamat proxy benar.';
  }
  if (/timed out|Connection refused|Name or service not known|getaddrinfo|Failed to resolve/i.test(msg)) {
    return 'Server tidak bisa menjangkau situs tersebut. Jika situs butuh VPN, aktifkan VPN di server atau isi proxy VPN.';
  }
  if (/geo|not available in your country|blocked in your country/i.test(msg)) {
    return 'Video diblokir di wilayah ini. Gunakan VPN/proxy dari negara yang diizinkan.';
  }
  const clean = msg.replace(/^ERROR:\s*/gm, '').split('\n').filter(Boolean).pop() || 'Gagal memproses video.';
  return clean.length > 300 ? `${clean.slice(0, 300)}...` : clean;
}

// ---------------------------------------------------------------------------
// Subtitle bawaan sumber (tanpa transkripsi) — diambil lewat yt-dlp agar ikut proxy/VPN

export interface SubtitleSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

function pickSubtitleTrack(info: YtInfo, preferred: string[]) {
  const clean = (dict?: YtInfo['subtitles']) =>
    Object.keys(dict || {}).filter((k) => k !== 'live_chat' && (dict![k]?.length ?? 0) > 0);
  const find = (keys: string[]) => {
    for (const p of preferred) {
      const hit = keys.find((k) => k === p || k.startsWith(`${p}-`) || k.startsWith(`${p}_`));
      if (hit) return hit;
    }
    return undefined;
  };

  const manual = clean(info.subtitles);
  const manualKey = find(manual) || manual[0];
  if (manualKey) return { key: manualKey, auto: false };

  // Auto-caption: pilih bahasa asli ucapan (akhiran "-orig"), bukan hasil terjemahan mesin
  const auto = clean(info.automatic_captions);
  const autoKey = auto.find((k) => k.endsWith('-orig')) || (auto.length <= 2 ? find(auto) || auto[0] : undefined);
  if (autoKey) return { key: autoKey, auto: true };
  return null;
}

function parseClock(value: string): number {
  const parts = value.replace(',', '.').split(':').map(Number);
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
}

function cleanCueText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJson3(raw: string): SubtitleSegment[] {
  const data = JSON.parse(raw);
  return (data.events || [])
    .filter((e: any) => Array.isArray(e.segs))
    .map((e: any) => ({
      startSeconds: (e.tStartMs || 0) / 1000,
      endSeconds: ((e.tStartMs || 0) + (e.dDurationMs || 2000)) / 1000,
      text: cleanCueText(e.segs.map((s: any) => s.utf8 || '').join('')),
    }))
    .filter((s: SubtitleSegment) => s.text);
}

/** Parser VTT/SRT; menghapus baris berulang khas auto-caption ("rolling captions"). */
function parseCues(raw: string): SubtitleSegment[] {
  const out: SubtitleSegment[] = [];
  let prevLines: string[] = [];
  for (const block of raw.replace(/\r/g, '').split(/\n{2,}/)) {
    const lines = block.split('\n');
    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx < 0) continue;
    const [from, to] = lines[timeIdx].split('-->').map((t) => t.trim().split(' ')[0]);
    const textLines = lines.slice(timeIdx + 1).map(cleanCueText).filter(Boolean);
    const fresh = textLines.filter((l) => !prevLines.includes(l));
    prevLines = textLines;
    if (fresh.length === 0) continue;
    out.push({ startSeconds: parseClock(from), endSeconds: parseClock(to), text: fresh.join(' ') });
  }
  return out;
}

/**
 * Unduh subtitle bawaan video (manual atau auto-caption) bila tersedia.
 * Mengembalikan null bila sumber tidak punya subtitle.
 */
export async function fetchSubtitles(
  url: string,
  info: YtInfo,
  outDir: string,
  preferredLanguages: string[],
  net: NetOptions = {}
): Promise<{ segments: SubtitleSegment[]; language: string; auto: boolean } | null> {
  const track = pickSubtitleTrack(info, preferredLanguages);
  if (!track) return null;

  const bin = await getYtDlpPath();
  await fs.promises.mkdir(outDir, { recursive: true });
  await runProcess(bin, [
    ...baseArgs(net),
    '--skip-download',
    track.auto ? '--write-auto-subs' : '--write-subs',
    '--sub-langs', track.key,
    '--sub-format', 'json3/vtt/srt/best',
    '-o', path.join(outDir, 'sub.%(ext)s'),
    url,
  ]);

  const file = (await fs.promises.readdir(outDir)).find((f) => f.startsWith('sub.'));
  if (!file) return null;
  const raw = await fs.promises.readFile(path.join(outDir, file), 'utf8');
  const segments = file.endsWith('.json3') ? parseJson3(raw) : parseCues(raw);
  if (segments.length === 0) return null;
  return { segments, language: track.key.replace(/-orig$/, ''), auto: track.auto };
}
