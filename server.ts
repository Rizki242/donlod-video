import './server/env.ts';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { createJob, getJob, publicJob, UPLOAD_DIR, WORK_ROOT } from './server/jobs.ts';
import { assertPublicUrl } from './server/security.ts';
import { rateLimit, securityHeaders } from './server/rateLimit.ts';
import {
  buildDownloadOptions,
  downloadMedia,
  fetchSubtitles,
  getVideoInfo,
  isValidPreset,
  resolveProxy,
  type NetOptions,
  type YtInfo,
} from './server/ytdlp.ts';
import { formatTime, transcribeMediaFile, type TranscriptSegment } from './server/transcribe.ts';
import { searchTranscript, summarizeTranscript } from './server/summarize.ts';
import { languageName, loadWhisper, WHISPER_MODEL } from './server/stt.ts';
import { getYtDlpPath } from './server/tools.ts';
import {
  createShare,
  deleteShare,
  getShare,
  isOwner,
  mimeFromName,
  publicShare,
  shareFilePath,
  updateShare,
} from './server/shares.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 2048);

// Di belakang reverse proxy (nginx, Cloudflare, dll.) set TRUST_PROXY=1 agar IP klien terbaca benar untuk rate limit
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
app.disable('x-powered-by');
app.use(securityHeaders);

// Transkrip panjang bisa besar, tetapi 20 MB per permintaan JSON berlebihan
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Pembatasan laju: umum untuk semua API, lebih ketat untuk operasi berat (yt-dlp, Whisper, upload)
const heavyLimit = rateLimit({
  windowMs: 10 * 60_000,
  max: Number(process.env.RATE_LIMIT_HEAVY || 30),
  message: 'Terlalu banyak permintaan pemrosesan. Coba lagi dalam beberapa menit.',
});
app.use('/api', rateLimit({ windowMs: 60_000, max: Number(process.env.RATE_LIMIT_GENERAL || 600) }));
for (const route of ['/api/video/info', '/api/download', '/api/transcribe/url', '/api/transcribe/upload', '/api/shares', '/api/shares/from-job', '/api/shares/:id/transcribe']) {
  app.post(route, heavyLimit);
}

// Siapkan yt-dlp & model Whisper di latar belakang agar permintaan pertama tidak menunggu lama
getYtDlpPath().catch((err) => console.warn('[tools] yt-dlp belum siap:', err.message));
if (process.env.WHISPER_PRELOAD !== 'false') {
  loadWhisper().then(
    () => console.log(`[stt] Model Whisper siap: ${WHISPER_MODEL}`),
    (err) => console.warn('[stt]', err.message)
  );
}

function readUrlBody(req: Request): string {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw Object.assign(new Error('URL video tidak boleh kosong.'), { status: 400 });
  }
  return url.trim();
}

/** Bahasa ucapan yang dipilih pengguna: "auto" atau kode ISO dua huruf. */
function readLanguage(req: Request): string {
  const value = String(req.body?.language || 'auto').toLowerCase();
  return /^(auto|[a-z]{2,3})$/.test(value) ? value : 'auto';
}

/** Express 4 tidak menangkap penolakan promise di handler async; teruskan ke error middleware. */
const safe = (fn: (req: Request, res: Response) => Promise<unknown> | unknown) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/** Validasi URL + proxy dari body permintaan. */
async function readNetRequest(req: Request): Promise<{ url: string; net: NetOptions }> {
  const url = readUrlBody(req);
  const net: NetOptions = { proxy: resolveProxy(req.body?.proxy) };
  await assertPublicUrl(url, { viaProxy: !!net.proxy });
  return { url, net };
}

function toTranscriptSegments(items: Array<{ startSeconds: number; endSeconds: number; text: string }>): TranscriptSegment[] {
  return items.map((s, i) => ({
    id: i + 1,
    start: formatTime(s.startSeconds),
    end: formatTime(s.endSeconds),
    startSeconds: Math.round(s.startSeconds * 10) / 10,
    endSeconds: Math.round(s.endSeconds * 10) / 10,
    speaker: 'Pembicara',
    text: s.text,
  }));
}

// 0. Konfigurasi publik untuk UI
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    defaultProxy: !!process.env.PROXY_URL,
    whisperModel: WHISPER_MODEL,
    maxUploadMb: MAX_UPLOAD_MB,
  });
});

// 1. Video Info — metadata, format unduhan, dan subtitle bawaan (semua lewat yt-dlp, ikut proxy/VPN)
app.post('/api/video/info', async (req: Request, res: Response) => {
  try {
    const { url, net } = await readNetRequest(req);
    const language = readLanguage(req);

    let info: YtInfo;
    try {
      info = await getVideoInfo(url, net);
    } catch (err: any) {
      res.status(422).json({ error: err.message || 'Tautan tidak didukung atau video tidak dapat diakses.' });
      return;
    }

    // Jalur cepat: subtitle bawaan sumber (bila ada) — tidak perlu speech-to-text
    let captions: Awaited<ReturnType<typeof fetchSubtitles>> = null;
    const subDir = path.join(WORK_ROOT, `subs-${randomUUID()}`);
    try {
      const preferred = language === 'auto' ? ['id', 'en'] : [language];
      captions = await fetchSubtitles(url, info, subDir, preferred, net);
    } catch (err: any) {
      console.warn('Subtitle tidak dapat diambil:', err.message);
    } finally {
      fs.promises.rm(subDir, { recursive: true, force: true }).catch(() => {});
    }

    const segments = captions ? toTranscriptSegments(captions.segments) : [];
    const durationSeconds = info.duration ? Math.round(info.duration) : undefined;
    const isYouTube = info.extractor_key === 'Youtube';

    res.json({
      type: isYouTube ? 'youtube' : 'web_video',
      videoId: info.id,
      url: info.webpage_url || url,
      title: info.title || 'Video',
      author: info.uploader || info.channel || new URL(url).hostname,
      thumbnailUrl: info.thumbnail || '',
      duration: durationSeconds ? formatTime(durationSeconds) : undefined,
      durationSeconds,
      source: info.extractor_key || 'Web',
      captionsAvailable: segments.length > 0,
      captionsAuto: captions?.auto,
      language: captions ? languageName(captions.language) : 'Otomatis',
      segments,
      fullText: segments.map((s) => s.text).join(' '),
      downloadOptions: buildDownloadOptions(info),
    });
  } catch (error: any) {
    console.error('Error fetching video info:', error);
    res.status(error.status || 400).json({ error: error.message || 'Gagal mengambil informasi video.' });
  }
});

// 2. Download Job — unduh video/audio di server, lalu klien mengambil file via /api/jobs/:id/file
app.post('/api/download', async (req: Request, res: Response) => {
  try {
    const preset = String(req.body.preset || '');
    if (!isValidPreset(preset) || preset === 'audio-speech') {
      res.status(400).json({ error: 'Format unduhan tidak valid.' });
      return;
    }
    const { url, net } = await readNetRequest(req);

    const job = createJob('download', async ({ job, update }) => {
      update(1, net.proxy ? 'Menyiapkan unduhan lewat proxy/VPN...' : 'Menyiapkan unduhan...');
      const result = await downloadMedia(
        url,
        preset,
        job.workDir,
        (fraction, message) => update(2 + fraction * 97, message),
        net
      );
      const ext = path.extname(result.filePath);
      const safeTitle = (result.title || 'video').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, 120) || 'video';
      const qualityTag = preset.startsWith('video-') && preset !== 'video-best' ? ` [${preset.replace('video-', '')}p]` : '';
      job.filePath = result.filePath;
      job.fileName = `${safeTitle}${qualityTag}${ext}`;
      const size = (await fs.promises.stat(result.filePath)).size;
      job.result = { fileName: job.fileName, size };
      update(100, 'File siap diunduh');
    });

    res.status(202).json({ jobId: job.id });
  } catch (error: any) {
    res.status(error.status || 400).json({ error: error.message || 'Gagal memulai unduhan.' });
  }
});

// 3. Transkripsi dari URL — unduh audio dengan sistem sendiri lalu Whisper lokal mengubahnya ke teks
app.post('/api/transcribe/url', async (req: Request, res: Response) => {
  try {
    const { url, net } = await readNetRequest(req);
    const language = readLanguage(req);

    const job = createJob('transcribe', async ({ job, update }) => {
      update(1, 'Mengunduh audio dari sumber video...');
      const audio = await downloadMedia(
        url,
        'audio-speech',
        job.workDir,
        (fraction) => update(1 + fraction * 19, `Mengunduh audio dari sumber video... ${Math.round(fraction * 100)}%`),
        net
      );
      job.result = await transcribeMediaFile(audio.filePath, job.workDir, {
        language,
        onProgress: (fraction, message) => update(20 + fraction * 79, message),
      });
      update(100, 'Transkripsi selesai');
    });

    res.status(202).json({ jobId: job.id });
  } catch (error: any) {
    res.status(error.status || 400).json({ error: error.message || 'Gagal memulai transkripsi.' });
  }
});

// 4. Transkripsi dari file upload (video/audio lokal)
const MEDIA_EXTENSIONS = /\.(mp4|m4v|mov|mkv|webm|avi|wmv|flv|3gp|mpeg|mpg|ts|mp3|wav|m4a|aac|ogg|oga|opus|flac|wma|amr)$/i;
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(audio|video)\//.test(file.mimetype) || MEDIA_EXTENSIONS.test(file.originalname);
    if (ok) cb(null, true);
    else cb(new Error('Format file tidak didukung. Unggah file video atau audio.'));
  },
});

/** Middleware upload satu file media dengan pesan error yang ramah. */
function receiveUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: any) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `Ukuran file melebihi batas ${MAX_UPLOAD_MB} MB.`
      : err.message || 'Gagal mengunggah file.';
    res.status(400).json({ error: message });
  });
}

app.post(
  '/api/transcribe/upload',
  receiveUpload,
  (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'File video/audio wajib diunggah.' });
      return;
    }
    const language = readLanguage(req);

    const job = createJob('transcribe', async ({ job, update }) => {
      const inputPath = path.join(job.workDir, `input${path.extname(file.originalname) || ''}`);
      await fs.promises.rename(file.path, inputPath).catch(async () => {
        await fs.promises.copyFile(file.path, inputPath);
        await fs.promises.rm(file.path, { force: true });
      });
      job.result = await transcribeMediaFile(inputPath, job.workDir, {
        language,
        onProgress: (fraction, message) => update(fraction * 99, message),
      });
      // File asli tidak dibutuhkan lagi setelah audio diekstrak
      await fs.promises.rm(inputPath, { force: true });
      update(100, 'Transkripsi selesai');
    });

    res.status(202).json({ jobId: job.id });
  }
);

// 5. Status job & pengambilan file hasil
app.get('/api/jobs/:id', (req: Request, res: Response) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job tidak ditemukan atau sudah kedaluwarsa.' });
    return;
  }
  res.json(publicJob(job));
});

app.get('/api/jobs/:id/file', (req: Request, res: Response) => {
  const job = getJob(req.params.id);
  if (!job || job.status !== 'done' || !job.filePath || !fs.existsSync(job.filePath)) {
    res.status(404).send('File tidak ditemukan atau sudah kedaluwarsa. Silakan ulangi unduhan.');
    return;
  }
  res.download(job.filePath, job.fileName || path.basename(job.filePath));
});

/** Normalisasi array segmen dari klien (bisa berupa string JSON dari form multipart). */
function sanitizeSegments(raw: unknown): TranscriptSegment[] {
  let segments = raw;
  if (typeof segments === 'string') {
    try {
      segments = JSON.parse(segments);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(segments)) return [];
  return segments
    .filter((s: any) => s && typeof s.text === 'string')
    .map((s: any, i: number) => ({
      id: Number(s.id) || i + 1,
      start: String(s.start || formatTime(Number(s.startSeconds) || 0)),
      end: String(s.end || formatTime(Number(s.endSeconds) || 0)),
      startSeconds: Number(s.startSeconds) || 0,
      endSeconds: Number(s.endSeconds) || 0,
      speaker: String(s.speaker || 'Pembicara'),
      text: s.text,
    }));
}

function readSegments(req: Request): TranscriptSegment[] {
  const segments = sanitizeSegments(req.body?.segments);
  if (segments.length === 0) {
    throw Object.assign(new Error('Transkrip tidak boleh kosong.'), { status: 400 });
  }
  return segments;
}

// 8. Halaman berbagi video (/d/:id)
async function loadShareOr404(req: Request, res: Response) {
  const meta = await getShare(String(req.params.id));
  if (!meta) res.status(404).json({ error: 'Video tidak ditemukan atau sudah dihapus.' });
  return meta;
}

function ownerTokenFrom(req: Request): unknown {
  return req.get('x-owner-token') || req.body?.ownerToken;
}

// Buat share dari file upload (opsional beserta transkrip yang sudah ada)
app.post('/api/shares', receiveUpload, async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'File video/audio wajib diunggah.' });
    return;
  }
  try {
    const meta = await createShare({
      sourcePath: file.path,
      fileName: file.originalname,
      title: String(req.body.title || ''),
      segments: sanitizeSegments(req.body.segments),
      durationSeconds: Number(req.body.durationSeconds) || undefined,
      language: req.body.language ? String(req.body.language).slice(0, 40) : undefined,
    });
    res.status(201).json({ ...publicShare(meta), ownerToken: meta.ownerToken });
  } catch (error: any) {
    fs.promises.rm(file.path, { force: true }).catch(() => {});
    res.status(500).json({ error: error.message || 'Gagal membuat halaman berbagi.' });
  }
});

// Buat share dari hasil job unduhan (video dari URL yang sudah diunduh server)
app.post('/api/shares/from-job', async (req: Request, res: Response) => {
  try {
    const job = getJob(String(req.body.jobId || ''));
    if (!job || job.kind !== 'download' || job.status !== 'done' || !job.filePath || !fs.existsSync(job.filePath)) {
      res.status(404).json({ error: 'File unduhan tidak ditemukan atau sudah kedaluwarsa.' });
      return;
    }
    const meta = await createShare({
      sourcePath: job.filePath,
      fileName: job.fileName || path.basename(job.filePath),
      title: String(req.body.title || ''),
      segments: sanitizeSegments(req.body.segments),
      durationSeconds: Number(req.body.durationSeconds) || undefined,
      language: req.body.language ? String(req.body.language).slice(0, 40) : undefined,
    });
    // File sudah dipindahkan ke penyimpanan permanen
    job.filePath = undefined;
    res.status(201).json({ ...publicShare(meta), ownerToken: meta.ownerToken });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal membuat halaman berbagi.' });
  }
});

app.get('/api/shares/:id', safe(async (req: Request, res: Response) => {
  const meta = await loadShareOr404(req, res);
  if (!meta) return;
  res.json({ ...publicShare(meta), isOwner: isOwner(meta, ownerTokenFrom(req)) });
}));

// Streaming mendukung Range agar video bisa di-seek di pemutar
app.get('/api/shares/:id/stream', safe(async (req: Request, res: Response) => {
  const meta = await getShare(String(req.params.id));
  if (!meta) {
    res.status(404).send('Video tidak ditemukan.');
    return;
  }
  // MIME dihitung ulang dari ekstensi file tersimpan (share lama mungkin menyimpan MIME dari klien);
  // sandbox CSP mencegah skrip berjalan seandainya file dibuka langsung sebagai dokumen
  res.sendFile(shareFilePath(meta), {
    headers: {
      'Content-Type': mimeFromName(meta.storedName),
      'Content-Security-Policy': 'sandbox',
    },
    acceptRanges: true,
  });
}));

app.get('/api/shares/:id/download', safe(async (req: Request, res: Response) => {
  const meta = await getShare(String(req.params.id));
  if (!meta) {
    res.status(404).send('Video tidak ditemukan.');
    return;
  }
  res.download(shareFilePath(meta), meta.fileName);
}));

app.patch('/api/shares/:id', safe(async (req: Request, res: Response) => {
  const meta = await loadShareOr404(req, res);
  if (!meta) return;
  if (!isOwner(meta, ownerTokenFrom(req))) {
    res.status(403).json({ error: 'Hanya pemilik yang dapat mengubah video ini.' });
    return;
  }
  const patch: Parameters<typeof updateShare>[1] = {};
  if (typeof req.body.title === 'string' && req.body.title.trim()) patch.title = req.body.title.trim().slice(0, 200);
  if (req.body.segments !== undefined) patch.segments = sanitizeSegments(req.body.segments);
  res.json(publicShare(await updateShare(meta, patch)));
}));

app.delete('/api/shares/:id', safe(async (req: Request, res: Response) => {
  const meta = await loadShareOr404(req, res);
  if (!meta) return;
  if (!isOwner(meta, ownerTokenFrom(req))) {
    res.status(403).json({ error: 'Hanya pemilik yang dapat menghapus video ini.' });
    return;
  }
  await deleteShare(meta);
  res.json({ success: true });
}));

// Pemilik bisa membuat transkrip untuk video yang dibagikan
app.post('/api/shares/:id/transcribe', safe(async (req: Request, res: Response) => {
  const meta = await loadShareOr404(req, res);
  if (!meta) return;
  if (!isOwner(meta, ownerTokenFrom(req))) {
    res.status(403).json({ error: 'Hanya pemilik yang dapat membuat transkrip.' });
    return;
  }
  const language = readLanguage(req);
  const job = createJob('transcribe', async ({ job, update }) => {
    const result = await transcribeMediaFile(shareFilePath(meta), job.workDir, {
      language,
      onProgress: (fraction, message) => update(fraction * 99, message),
    });
    const latest = (await getShare(meta.id)) || meta;
    await updateShare(latest, {
      segments: result.segments,
      durationSeconds: result.durationSeconds,
      language: result.detectedLanguage,
    });
    job.result = result;
    update(100, 'Transkripsi selesai');
  });
  res.status(202).json({ jobId: job.id });
}));

// 6. Ringkasan otomatis (ekstraktif, tanpa LLM)
app.post('/api/summarize', (req: Request, res: Response) => {
  try {
    const segments = readSegments(req);
    const { title = 'Video', summaryStyle = 'standard' } = req.body;
    res.json({ success: true, summary: summarizeTranscript(segments, String(title), String(summaryStyle)) });
  } catch (error: any) {
    console.error('Error generating summary:', error);
    res.status(error.status || 500).json({ error: error.message || 'Gagal membuat ringkasan.' });
  }
});

// 7. Cari di transkrip (pengganti tanya-jawab LLM)
app.post('/api/search', (req: Request, res: Response) => {
  try {
    const segments = readSegments(req);
    const query = String(req.body.query || '').trim();
    if (!query) {
      res.status(400).json({ error: 'Kata kunci pencarian tidak boleh kosong.' });
      return;
    }
    res.json({ results: searchTranscript(segments, query, Number(req.body.limit) || 5) });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message || 'Gagal mencari di transkrip.' });
  }
});

/** Penangan error terakhir: respons JSON seragam tanpa membocorkan stack trace. */
function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('[error]', err);
  if (res.headersSent) return;
  const status = err?.status || err?.statusCode || 500;
  res.status(status).json({ error: status >= 500 ? 'Terjadi kesalahan pada server.' : err.message });
}

// Production vs Development Vite setup
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    // Serve static files from dist (server.js hasil build berada di dalam dist/)
    const distDir = fs.existsSync(path.join(__dirname, 'index.html')) ? __dirname : path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    // Vite middleware in development
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.use(errorHandler);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
