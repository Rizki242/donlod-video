import React, { useState } from 'react';
import {
  Download,
  Film,
  Music,
  ExternalLink,
  CheckCircle2,
  FileText,
  Subtitles,
  Sparkles,
  Layers,
  HardDrive,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  AudioLines,
} from 'lucide-react';
import { VideoMetadata, TranscriptSegment, VideoSummary, VideoDownloadOption } from '../types';
import { generateSrt, generateVtt, downloadFile } from '../utils/exportFormats';
import { downloadViaServer } from '../utils/jobs';
import { ShareCard } from './ShareCard';

interface VideoDownloadViewProps {
  metadata: VideoMetadata;
  segments: TranscriptSegment[];
  summary: VideoSummary | null;
  onOpenExportModal: () => void;
  onToast: (msg: string) => void;
  onTranscribeSource?: (onProgress: (progress: number, message: string) => void) => Promise<void>;
}

// Opsi bawaan bila server belum memberi daftar format (mis. data demo)
const DEFAULT_SERVER_OPTIONS: VideoDownloadOption[] = [
  { label: 'Video MP4 1080p (Full HD)', resolution: '1080p', format: 'mp4', quality: 'Full HD', type: 'video', preset: 'video-1080', actionType: 'server' },
  { label: 'Video MP4 720p (HD)', resolution: '720p', format: 'mp4', quality: 'HD', type: 'video', preset: 'video-720', actionType: 'server' },
  { label: 'Video MP4 360p (SD)', resolution: '360p', format: 'mp4', quality: 'SD Hemat Kuota', type: 'video', preset: 'video-360', actionType: 'server' },
  { label: 'Audio MP3 (Kualitas Tinggi)', resolution: 'MP3 VBR ~245 kbps', format: 'mp3', quality: 'Audio Berkualitas Tinggi', type: 'audio', preset: 'audio-mp3', actionType: 'server' },
  { label: 'Audio M4A / AAC (Asli)', resolution: 'AAC dari sumber', format: 'm4a', quality: 'Tanpa konversi ulang', type: 'audio', preset: 'audio-m4a', actionType: 'server' },
];

interface RowProgress {
  progress: number;
  message: string;
}

export const VideoDownloadView: React.FC<VideoDownloadViewProps> = ({
  metadata,
  segments,
  summary,
  onOpenExportModal,
  onToast,
  onTranscribeSource,
}) => {
  const [rowProgress, setRowProgress] = useState<Record<string, RowProgress>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [copiedLink, setCopiedLink] = useState(false);
  const [transcribeState, setTranscribeState] = useState<RowProgress | null>(null);
  const [transcribeError, setTranscribeError] = useState('');

  const cleanFilename = metadata.title.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40);
  const isUpload = metadata.type === 'upload';

  const options: VideoDownloadOption[] = isUpload
    ? [
        {
          label: 'File Asli (Unggahan)',
          resolution: metadata.fileSize || 'Ukuran asli',
          format: metadata.file?.name.split('.').pop() || 'mp4',
          quality: 'Tanpa perubahan',
          type: metadata.file?.type.startsWith('audio/') ? 'audio' : 'video',
          actionType: 'local',
        },
      ]
    : metadata.downloadOptions?.length
      ? metadata.downloadOptions
      : metadata.url
        ? DEFAULT_SERVER_OPTIONS
        : [];

  const rowKey = (opt: VideoDownloadOption) => opt.preset || opt.label;

  const handleDownload = async (opt: VideoDownloadOption) => {
    const key = rowKey(opt);

    if (opt.actionType === 'local') {
      if (!metadata.localFileUrl || !metadata.file) return;
      const a = document.createElement('a');
      a.href = metadata.localFileUrl;
      a.download = metadata.file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      onToast(`Mengunduh file: ${metadata.file.name}`);
      return;
    }

    if (!metadata.url || !opt.preset || rowProgress[key]) return;
    setRowError((prev) => ({ ...prev, [key]: '' }));
    setRowProgress((prev) => ({ ...prev, [key]: { progress: 0, message: 'Memulai...' } }));

    try {
      const result = await downloadViaServer(metadata.url, opt.preset, (progress, message) =>
        setRowProgress((prev) => ({ ...prev, [key]: { progress, message } }))
      );
      onToast(`Unduhan siap: ${result.fileName}`);
    } catch (err: any) {
      setRowError((prev) => ({ ...prev, [key]: err.message || 'Gagal mengunduh.' }));
      onToast(`Gagal mengunduh: ${err.message}`);
    } finally {
      setRowProgress((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleTranscribe = async () => {
    if (!onTranscribeSource || transcribeState) return;
    setTranscribeError('');
    setTranscribeState({ progress: 0, message: 'Memulai...' });
    try {
      await onTranscribeSource((progress, message) => setTranscribeState({ progress, message }));
    } catch (err: any) {
      setTranscribeError(err.message || 'Gagal mentranskrip audio.');
    } finally {
      setTranscribeState(null);
    }
  };

  const renderAction = (opt: VideoDownloadOption, accent: 'indigo' | 'emerald') => {
    const state = rowProgress[rowKey(opt)];
    const colors =
      accent === 'indigo'
        ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
        : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20';
    return (
      <button
        onClick={() => handleDownload(opt)}
        disabled={!!state}
        className={`px-4 py-2 rounded-xl ${colors} disabled:opacity-80 disabled:cursor-wait text-white text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md min-w-[96px] justify-center`}
      >
        {state ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="font-mono">{state.progress}%</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" />
            <span>Unduh {opt.format.toUpperCase()}</span>
          </>
        )}
      </button>
    );
  };

  const renderRowStatus = (opt: VideoDownloadOption) => {
    const key = rowKey(opt);
    const state = rowProgress[key];
    const error = rowError[key];
    if (state) {
      return (
        <div className="mt-3">
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(3, state.progress)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{state.message}</p>
        </div>
      );
    }
    if (error) {
      return (
        <p className="mt-2 text-[11px] text-red-300 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{error}</span>
        </p>
      );
    }
    return null;
  };

  const handleDownloadFastSubtitle = (format: 'srt' | 'vtt') => {
    if (format === 'srt') {
      const srt = generateSrt(segments);
      downloadFile(srt, `${cleanFilename}_Subtitle.srt`, 'text/plain');
      onToast('Berhasil mengunduh Subtitle SRT!');
    } else {
      const vtt = generateVtt(segments);
      downloadFile(vtt, `${cleanFilename}_Subtitle.vtt`, 'text/vtt');
      onToast('Berhasil mengunduh Subtitle VTT!');
    }
  };

  const handleCopyLink = () => {
    if (metadata.url) {
      navigator.clipboard.writeText(metadata.url);
      setCopiedLink(true);
      onToast('Tautan video berhasil disalin ke clipboard!');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const videoOptions = options.filter((o) => o.type === 'video');
  const audioOptions = options.filter((o) => o.type === 'audio');

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">Unduh Video & Audio</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Siap Unduh
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Diunduh & dikonversi langsung oleh server VideoScribe — tanpa situs pihak ketiga
              </p>
            </div>
          </div>

          {metadata.url && (
            <button
              onClick={handleCopyLink}
              className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Tersalin' : 'Salin URL Video'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid: Video Downloads & Audio Downloads */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Video Formats (MP4) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-indigo-400" />
              <span>Format Video (MP4)</span>
            </h4>
            <span className="text-xs text-slate-400">Pilihan Resolusi</span>
          </div>

          <div className="space-y-3">
            {videoOptions.length === 0 && (
              <p className="text-xs text-slate-500">Tidak ada stream video — sumber ini hanya berisi audio.</p>
            )}
            {videoOptions.map((opt, idx) => (
              <div
                key={rowKey(opt)}
                className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 transition-all shadow-md group"
              >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
                    <Film className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h5 className="text-xs sm:text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">
                        {opt.label}
                      </h5>
                      {idx === 0 && (
                        <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          HQ
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>{opt.resolution}</span>
                      <span>•</span>
                      <span>Format: {opt.format.toUpperCase()}</span>
                      {opt.sizeEstimate && (
                        <>
                          <span>•</span>
                          <span className="text-slate-500">{opt.sizeEstimate}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {renderAction(opt, 'indigo')}
              </div>
              {renderRowStatus(opt)}
              </div>
            ))}
          </div>

          {/* Quick Subtitle Downloads */}
          <div className="pt-2">
            <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <Subtitles className="w-4 h-4 text-amber-400" />
              <span>Subtitle Video Siap Pakai</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleDownloadFastSubtitle('srt')}
                className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-left flex items-center justify-between cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Subtitles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white group-hover:text-amber-300">
                      Unduh Subtitle (.srt)
                    </span>
                    <p className="text-[10px] text-slate-400">Untuk YouTube & Video Player</p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
              </button>

              <button
                onClick={() => handleDownloadFastSubtitle('vtt')}
                className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-violet-500/40 text-left flex items-center justify-between cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                    <Subtitles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white group-hover:text-violet-300">
                      Unduh Subtitle (.vtt)
                    </span>
                    <p className="text-[10px] text-slate-400">Standar WebVTT Modern</p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Audio Formats (MP3/M4A) & Complete Report */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Music className="w-4 h-4 text-emerald-400" />
              <span>Ekstraksi Audio (MP3 / Voice)</span>
            </h4>
            <span className="text-xs text-slate-400">Hanya Suara</span>
          </div>

          <div className="space-y-3">
            {audioOptions.map((opt) => (
              <div
                key={rowKey(opt)}
                className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 transition-all shadow-md group"
              >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                    <Music className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs sm:text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors truncate">
                      {opt.label}
                    </h5>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>{opt.quality}</span>
                      {opt.sizeEstimate && (
                        <>
                          <span>•</span>
                          <span className="text-slate-500">{opt.sizeEstimate}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {renderAction(opt, 'emerald')}
              </div>
              {renderRowStatus(opt)}
              </div>
            ))}
          </div>

          <ShareCard metadata={metadata} segments={segments} videoOptions={videoOptions} onToast={onToast} />

          {/* Convert source audio to text */}
          {!isUpload && metadata.url && onTranscribeSource && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-950/50 to-slate-900 border border-violet-500/30 shadow-lg space-y-3 mt-4">
              <div className="flex items-center gap-2.5">
                <AudioLines className="w-5 h-5 text-violet-300" />
                <div>
                  <h5 className="text-xs sm:text-sm font-bold text-white">Konversi Audio ke Teks</h5>
                  <p className="text-[11px] text-slate-400">
                    {metadata.transcriptSource === 'captions'
                      ? 'Transkrip saat ini dari subtitle bawaan. Transkrip ulang langsung dari suara video untuk hasil lebih akurat.'
                      : 'Server mengunduh audio video lalu Whisper (lokal) mengubahnya menjadi teks dengan timestamp.'}
                  </p>
                </div>
              </div>

              {transcribeState && (
                <div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-violet-500 to-amber-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(3, transcribeState.progress)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{transcribeState.message}</p>
                </div>
              )}
              {transcribeError && (
                <p className="text-[11px] text-red-300 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span>{transcribeError}</span>
                </p>
              )}

              <button
                onClick={handleTranscribe}
                disabled={!!transcribeState}
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-70 disabled:cursor-wait text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-violet-600/25 transition-all"
              >
                {transcribeState ? <Loader2 className="w-4 h-4 animate-spin" /> : <AudioLines className="w-4 h-4" />}
                <span>
                  {transcribeState
                    ? `Memproses... ${transcribeState.progress}%`
                    : metadata.transcriptSource === 'ai'
                      ? 'Transkrip Ulang dari Audio'
                      : 'Transkrip dari Audio Asli'}
                </span>
              </button>
            </div>
          )}

          {/* Document Export Promotion Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-500/30 shadow-lg space-y-3 mt-4">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-indigo-400" />
              <div>
                <h5 className="text-xs sm:text-sm font-bold text-white">Laporan PDF & Ringkasan</h5>
                <p className="text-[11px] text-slate-400">
                  Ekspor naskah transkrip lengkap dan ringkasan eksekutif
                </p>
              </div>
            </div>

            <button
              onClick={onOpenExportModal}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/25 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Buka Menu Ekspor PDF / Markdown / TXT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
