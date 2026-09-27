# VideoScribe — Unduh Video & Transkripsi Lokal

Pengunduh video/audio + speech-to-text yang berjalan sepenuhnya di server sendiri.
**Tidak memakai LLM atau API AI pihak ketiga** — tidak perlu API key.

## Menjalankan

Prasyarat: Node.js 20+

1. `npm install` (atau `bun install`)
2. (Opsional) salin `.env.example` ke `.env.local` dan sesuaikan
3. `npm run dev` → buka <http://localhost:3000>

Produksi: `npm run build` lalu `NODE_ENV=production npm start`.

Saat pertama kali jalan, server otomatis mengunduh:

- **yt-dlp** ke `./bin` (mesin pengunduh)
- **model Whisper** ke `./models` (~450 MB untuk `whisper-small`, sekali saja)

## Fitur

- **Pengunduh internal** — yt-dlp + ffmpeg: YouTube, TikTok, Instagram, Facebook, X, Vimeo, link MP4 langsung,
  dan ribuan situs lain. Pilihan resolusi sesuai format yang tersedia, audio MP3/M4A.
- **VPN / proxy** — untuk situs yang harus dibuka lewat VPN:
  - VPN aktif di mesin server (system-wide) → langsung jalan, tanpa pengaturan.
  - VPN menyediakan proxy lokal → isi `PROXY_URL` (mis. `socks5://127.0.0.1:1080`) atau isi di
    *Pengaturan bahasa & VPN / proxy* pada halaman awal.
  - Situs intranet (IP privat) via VPN kantor/kampus → set `ALLOW_PRIVATE_URLS=true`.
  - Situs yang butuh login → ekspor cookies browser ke file lalu set `YTDLP_COOKIES_FILE`.
- **Video/URL → teks** — subtitle bawaan sumber dipakai bila ada; bila tidak, audio diunduh lalu
  ditranskrip oleh **Whisper lokal** (deteksi bahasa otomatis, hingga 180 menit).
- **Upload → teks** — file video/audio diunggah (default maks. 2 GB) dan diproses dengan pipeline yang sama.
- **Ringkasan ekstraktif** — memilih kalimat terpenting (TF-IDF), bab per rentang waktu, poin aksi,
  tanya-jawab yang diucapkan di video, dan kata kunci. Tanpa LLM.
- **Cari di transkrip** — cari kata/topik lalu lompat ke detik video.
- Ekspor PDF, SRT, VTT, TXT, Markdown.

Kecepatan transkripsi bergantung CPU server (whisper-small ≈ 3× lebih cepat dari durasi audio di laptop
modern). Ganti `WHISPER_MODEL` ke `whisper-base` untuk lebih cepat atau `whisper-large-v3-turbo` untuk lebih akurat.
