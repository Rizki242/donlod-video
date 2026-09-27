import React, { useRef, useEffect, useState } from 'react';
import {
  Play,
  Pause,
  Download,
  ExternalLink,
  Volume2,
  VolumeX,
  FileVideo,
  FileAudio,
  Sparkles,
  Maximize2,
  Film,
  Music,
} from 'lucide-react';
import { VideoMetadata } from '../types';

interface VideoPlayerViewProps {
  metadata: VideoMetadata;
  seekTime: number | null;
  onTimeUpdate?: (currentTime: number) => void;
  onOpenExportModal: () => void;
  onNavigateToDownload?: () => void;
}

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  metadata,
  seekTime,
  onTimeUpdate,
  onOpenExportModal,
  onNavigateToDownload,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [downloadDropdown, setDownloadDropdown] = useState(false);

  // Sync seekTime when clicked in transcript or chapters
  useEffect(() => {
    if (seekTime !== null && videoRef.current) {
      videoRef.current.currentTime = seekTime;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [seekTime]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      setCurrentTime(cur);
      onTimeUpdate?.(cur);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownloadOriginal = () => {
    if (metadata.localFileUrl && metadata.file) {
      const a = document.createElement('a');
      a.href = metadata.localFileUrl;
      a.download = metadata.file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (metadata.url) {
      window.open(metadata.url, '_blank');
    }
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Player Display */}
        <div className="lg:col-span-7 bg-black flex flex-col justify-center relative min-h-[260px] sm:min-h-[340px]">
          {metadata.type === 'youtube' && metadata.videoId ? (
            <div className="relative w-full aspect-video">
              <iframe
                ref={iframeRef}
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${metadata.videoId}?enablejsapi=1&autoplay=0`}
                title={metadata.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : metadata.localFileUrl ? (
            <div className="relative group">
              <video
                ref={videoRef}
                src={metadata.localFileUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                className="w-full max-h-[380px] object-contain mx-auto"
                controls
              />
            </div>
          ) : (
            <div className="relative aspect-video flex flex-col items-center justify-center p-6 text-center">
              {metadata.thumbnailUrl ? (
                <img
                  src={metadata.thumbnailUrl}
                  alt={metadata.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
              ) : null}
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center mx-auto mb-3">
                  <Film className="w-7 h-7 text-indigo-400" />
                </div>
                <h4 className="text-sm font-semibold text-white">{metadata.title}</h4>
                <p className="text-xs text-slate-400 mt-1">Audio terhubung & siap dianalisis</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Metadata & Fast Actions */}
        <div className="lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  metadata.type === 'youtube'
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                }`}
              >
                {metadata.type === 'youtube' ? 'YouTube Stream' : 'File Media'}
              </span>
              <span className="text-xs text-slate-500">
                Durasi: {metadata.duration || (duration > 0 ? formatSeconds(duration) : 'Otomatis')}
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-white line-clamp-2 leading-snug">
              {metadata.title}
            </h2>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <span>{metadata.author || 'Konten Video'}</span>
              {metadata.fileSize && <span>• {metadata.fileSize}</span>}
            </p>

            <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="text-slate-400">Kapabilitas:</span>
                <span className="text-emerald-400 font-medium">Hingga 180 Menit</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="text-slate-400">Status Suara:</span>
                <span className="text-indigo-300 font-medium">Terpetakan dengan Timestamp</span>
              </div>
              {metadata.url && (
                <div className="flex items-center justify-between text-xs text-slate-300 truncate">
                  <span className="text-slate-400 shrink-0">Tautan:</span>
                  <a
                    href={metadata.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 hover:underline truncate max-w-[200px] flex items-center gap-1"
                  >
                    <span>Kunjungi Sumber</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 pt-4 border-t border-slate-800 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onNavigateToDownload || onOpenExportModal}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/25"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Video & Audio</span>
              </button>

              <button
                onClick={onOpenExportModal}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Film className="w-3.5 h-3.5 text-amber-400" />
                <span>Ekspor (PDF / SRT)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
