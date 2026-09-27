import React, { useState } from 'react';
import { Share2, Loader2, Copy, Check, ExternalLink, AlertCircle } from 'lucide-react';
import { TranscriptSegment, VideoDownloadOption, VideoMetadata } from '../types';
import { createShareFromFile, createShareFromUrl, shareLink } from '../utils/shares';

interface ShareCardProps {
  metadata: VideoMetadata;
  segments: TranscriptSegment[];
  videoOptions: VideoDownloadOption[];
  onToast: (msg: string) => void;
}

/** Jadikan video (upload atau hasil unduhan server) halaman berbagi /d/<id>. */
export const ShareCard: React.FC<ShareCardProps> = ({ metadata, segments, videoOptions, onToast }) => {
  const serverOptions = videoOptions.filter((o) => o.actionType === 'server' && o.preset);
  const defaultPreset =
    serverOptions.find((o) => o.preset === 'video-720')?.preset || serverOptions[0]?.preset || 'video-720';

  const [preset, setPreset] = useState(defaultPreset);
  const [state, setState] = useState<{ progress: number; message: string } | null>(null);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);

  const isUpload = metadata.type === 'upload';
  const canShare = isUpload ? !!metadata.file : !!metadata.url;

  const handleShare = async () => {
    if (!canShare || state) return;
    setError('');
    setState({ progress: 0, message: 'Memulai...' });
    const opts = {
      title: metadata.title,
      segments,
      durationSeconds: metadata.durationSeconds,
    };
    const onProgress = (progress: number, message: string) => setState({ progress, message });
    try {
      const share = isUpload
        ? await createShareFromFile(metadata.file!, opts, onProgress)
        : await createShareFromUrl(metadata.url!, preset, opts, onProgress);
      setLink(shareLink(share.id));
      onToast('Halaman berbagi siap!');
    } catch (err: any) {
      setError(err.message || 'Gagal membuat halaman berbagi.');
    } finally {
      setState(null);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!canShare) return null;

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 shadow-lg space-y-3 mt-4">
      <div className="flex items-center gap-2.5">
        <Share2 className="w-5 h-5 text-emerald-300" />
        <div>
          <h5 className="text-xs sm:text-sm font-bold text-white">Bagikan Video</h5>
          <p className="text-[11px] text-slate-400">
            Buat halaman video sendiri (pemutar, tombol unduh & transkrip) dengan link yang bisa dibagikan.
          </p>
        </div>
      </div>

      {!isUpload && serverOptions.length > 1 && !link && (
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          disabled={!!state}
          className="w-full px-3 py-2 bg-slate-950/70 border border-slate-700/80 rounded-lg text-xs text-slate-100 focus:outline-none"
        >
          {serverOptions.map((o) => (
            <option key={o.preset} value={o.preset}>
              {o.label}
              {o.sizeEstimate ? ` — ${o.sizeEstimate}` : ''}
            </option>
          ))}
        </select>
      )}

      {state && (
        <div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-indigo-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(3, state.progress)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{state.message}</p>
        </div>
      )}

      {error && (
        <p className="text-[11px] text-red-300 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{error}</span>
        </p>
      )}

      {link ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 px-3 py-2 bg-slate-950/70 border border-slate-700/80 rounded-lg text-xs text-emerald-200 font-mono"
            />
            <button
              onClick={copy}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Buka Halaman Video
          </a>
        </div>
      ) : (
        <button
          onClick={handleShare}
          disabled={!!state}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 disabled:cursor-wait text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/25"
        >
          {state ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          <span>{state ? `Memproses... ${state.progress}%` : 'Buat Link Berbagi'}</span>
        </button>
      )}
    </div>
  );
};
