import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Film,
  Trash2,
  Pencil,
  AudioLines,
  Subtitles,
  ArrowLeft,
} from 'lucide-react';
import { deleteShare, fetchShare, renameShare, shareLink, ShareInfo, transcribeShare } from '../utils/shares';
import { generateSrt, downloadFile } from '../utils/exportFormats';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function formatClock(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const SharePage: React.FC<{ id: string }> = ({ id }) => {
  const [share, setShare] = useState<ShareInfo | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [transcribe, setTranscribe] = useState<{ progress: number; message: string } | null>(null);
  const [actionError, setActionError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetchShare(id)
      .then((s) => {
        setShare(s);
        document.title = `${s.title} — VideoScribe`;
      })
      .catch((err) => setError(err.message));
  }, [id]);

  const segments = share?.segments ?? [];
  const activeIndex = segments.findIndex((s) => currentTime >= s.startSeconds && currentTime < s.endSeconds);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  const seek = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
    videoRef.current.play().catch(() => {});
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink(id));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRename = async () => {
    if (!share) return;
    const title = window.prompt('Judul baru:', share.title)?.trim();
    if (!title || title === share.title) return;
    try {
      const updated = await renameShare(id, title);
      setShare((prev) => (prev ? { ...prev, title: updated.title } : prev));
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Hapus video ini secara permanen? Link tidak akan bisa dibuka lagi.')) return;
    try {
      await deleteShare(id);
      window.location.href = '/';
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleTranscribe = async () => {
    setActionError('');
    setTranscribe({ progress: 0, message: 'Memulai transkripsi...' });
    try {
      await transcribeShare(id, (progress, message) => setTranscribe({ progress, message }));
      setShare(await fetchShare(id));
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setTranscribe(null);
    }
  };

  const isAudio = share?.mimeType.startsWith('audio/');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="border-b border-slate-900 bg-slate-950/80">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-sm font-bold text-white hover:text-indigo-300">
            <Film className="w-5 h-5 text-indigo-400" />
            VideoScribe
          </a>
          <a href="/" className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Beranda
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="max-w-md mx-auto mt-16 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h1 className="text-base font-bold text-white">Video tidak tersedia</h1>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
          </div>
        )}

        {!share && !error && (
          <div className="flex justify-center mt-24">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        )}

        {share && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Player + info */}
            <div className="lg:col-span-8 space-y-4">
              <div className="rounded-2xl overflow-hidden bg-black border border-slate-800">
                {isAudio ? (
                  <div className="p-8 flex flex-col items-center gap-4">
                    <AudioLines className="w-14 h-14 text-indigo-400" />
                    <audio
                      ref={videoRef as unknown as React.RefObject<HTMLAudioElement>}
                      src={share.streamUrl}
                      controls
                      className="w-full"
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    />
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    src={share.streamUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full max-h-[70vh] bg-black"
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  />
                )}
              </div>

              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white leading-snug break-words">{share.title}</h1>
                <p className="text-xs text-slate-400 mt-1">
                  {formatBytes(share.size)}
                  {share.durationSeconds ? ` • ${formatClock(share.durationSeconds)}` : ''}
                  {' • '}
                  {new Date(share.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={share.downloadUrl}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-md shadow-indigo-600/20"
                >
                  <Download className="w-4 h-4" />
                  Unduh ({share.fileName.split('.').pop()?.toUpperCase()}, {formatBytes(share.size)})
                </a>
                <button
                  onClick={copyLink}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Link tersalin' : 'Salin link'}
                </button>
                {segments.length > 0 && (
                  <button
                    onClick={() => downloadFile(generateSrt(segments), `${share.title.slice(0, 60)}.srt`, 'text/plain')}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Subtitles className="w-4 h-4 text-amber-400" />
                    Subtitle (.srt)
                  </button>
                )}
              </div>

              {share.isOwner && (
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Kelola (hanya Anda)</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleRename}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Ubah judul
                    </button>
                    <button
                      onClick={handleTranscribe}
                      disabled={!!transcribe}
                      className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-70 text-white text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {transcribe ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AudioLines className="w-3.5 h-3.5" />}
                      {transcribe ? `${transcribe.progress}%` : segments.length ? 'Buat ulang transkrip' : 'Buat transkrip'}
                    </button>
                    <button
                      onClick={handleDelete}
                      className="px-3 py-2 rounded-lg bg-red-600/15 hover:bg-red-600/25 border border-red-500/30 text-red-300 text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  </div>
                  {transcribe && <p className="text-[11px] text-slate-400">{transcribe.message}</p>}
                  {actionError && <p className="text-[11px] text-red-300">{actionError}</p>}
                </div>
              )}
            </div>

            {/* Transcript */}
            <aside className="lg:col-span-4">
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">Transkrip</h2>
                  {share.language && <span className="text-[10px] text-slate-400">{share.language}</span>}
                </div>
                {segments.length === 0 ? (
                  <p className="p-6 text-xs text-slate-500 text-center">Belum ada transkrip untuk video ini.</p>
                ) : (
                  <div className="max-h-[70vh] overflow-y-auto p-2 space-y-1">
                    {segments.map((s, i) => (
                      <button
                        key={s.id}
                        ref={i === activeIndex ? activeRef : undefined}
                        onClick={() => seek(s.startSeconds)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs leading-relaxed transition-colors cursor-pointer ${
                          i === activeIndex ? 'bg-indigo-600/20 text-white' : 'text-slate-300 hover:bg-slate-800/70'
                        }`}
                      >
                        <span className="font-mono text-[10px] text-indigo-300 mr-2">{s.start}</span>
                        {s.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
};
