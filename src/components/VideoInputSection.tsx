import React, { useState, useRef } from 'react';
import {
  Youtube,
  UploadCloud,
  Link2,
  FileVideo,
  FileAudio,
  Play,
  Sparkles,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ClipboardPaste,
  Settings2,
  ShieldCheck,
  Languages,
  Share2,
} from 'lucide-react';
import { SAMPLE_VIDEOS, SampleVideoItem } from '../data/sampleVideos';
import { getSettings, saveSettings, LANGUAGE_OPTIONS } from '../utils/settings';
import { getMyShares } from '../utils/shares';

interface VideoInputSectionProps {
  onProcessUrl: (url: string) => Promise<void>;
  onProcessFile: (file: File) => Promise<void>;
  onSelectSample: (sample: SampleVideoItem) => void;
  isLoading: boolean;
  statusMessage: string;
  progressPercentage: number;
}

export const VideoInputSection: React.FC<VideoInputSectionProps> = ({
  onProcessUrl,
  onProcessFile,
  onSelectSample,
  isLoading,
  statusMessage,
  progressPercentage,
}) => {
  const [tab, setTab] = useState<'url' | 'upload'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState(getSettings);
  const [showSettings, setShowSettings] = useState(() => !!getSettings().proxy);

  const updateSettings = (patch: Partial<typeof settings>) => setSettings(saveSettings(patch));
  const [myShares] = useState(getMyShares);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!urlInput.trim()) {
      setErrorMessage('Silakan masukkan URL YouTube atau link video web.');
      return;
    }
    try {
      await onProcessUrl(urlInput.trim());
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memproses URL.');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text.trim());
        setErrorMessage('');
      }
    } catch {
      // clipboard permission fallback
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage('');
    try {
      await onProcessFile(file);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memproses file video/audio.');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setErrorMessage('');
    try {
      await onProcessFile(file);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memproses file yang di-drop.');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Hero Title */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Pengunduh Video & Speech-to-Text di Server Sendiri</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Konversi Suara Video Menjadi <br className="hidden sm:inline" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-300 to-amber-300">
            Teks & Poin Ringkasan
          </span>
        </h1>
        <p className="mt-3 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
          Unduh video dari YouTube & situs web (termasuk yang butuh VPN), atau upload rekaman lokal hingga 180 menit.
          Suara diubah menjadi teks bertimestamp oleh Whisper yang berjalan di server — tanpa layanan AI pihak ketiga.
        </p>
      </div>

      {/* Main Input Box Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-sm">
        {/* Mode Tabs */}
        <div className="flex border-b border-slate-800 pb-3 mb-6 gap-2 sm:gap-4">
          <button
            onClick={() => {
              setTab('url');
              setErrorMessage('');
            }}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all cursor-pointer ${
              tab === 'url'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Youtube className="w-4 h-4 text-red-400" />
            <span>URL YouTube / Web Video</span>
          </button>

          <button
            onClick={() => {
              setTab('upload');
              setErrorMessage('');
            }}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all cursor-pointer ${
              tab === 'upload'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-indigo-400" />
            <span>Upload File Video / Audio</span>
          </button>
        </div>

        {/* Tab 1: URL Input */}
        {tab === 'url' && (
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Link2 className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Tempel link video (YouTube, TikTok, Instagram, Facebook, Vimeo, dll.)"
                disabled={isLoading}
                className="w-full pl-11 pr-28 py-3.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={handlePaste}
                disabled={isLoading}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Tempel</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>YouTube, Shorts, TikTok, Instagram, Facebook, X, Vimeo & link MP4 langsung</span>
              </div>

              <button
                type="submit"
                disabled={isLoading || !urlInput.trim()}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Ekstrak & Analisis Suara</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: File Upload */}
        {tab === 'upload' && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*,.mkv,.avi,.mp4,.webm,.mov,.mp3,.wav,.m4a,.flac,.ogg"
              onChange={handleFileChange}
              disabled={isLoading}
              className="hidden"
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !isLoading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/70'
              }`}
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <UploadCloud className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                Pilih atau seret file video / audio ke sini
              </h3>
              <p className="text-xs text-slate-400 mb-4 max-w-md mx-auto">
                Mendukung format video: <strong>MP4, WebM, MKV, MOV, AVI</strong> serta format audio:{' '}
                <strong>MP3, WAV, M4A, OGG, FLAC</strong> (Durasi maksimal 180 menit).
              </p>
              <button
                type="button"
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors inline-flex items-center gap-2"
              >
                <FileVideo className="w-3.5 h-3.5 text-indigo-400" />
                <span>Pilih File dari Komputer</span>
              </button>
            </div>
          </div>
        )}

        {/* Network & language settings */}
        <div className="mt-5 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Pengaturan bahasa & VPN / proxy</span>
            {settings.proxy && (
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Proxy aktif
              </span>
            )}
          </button>

          {showSettings && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
                  <Languages className="w-3.5 h-3.5" /> Bahasa ucapan di video
                </span>
                <select
                  value={settings.language}
                  onChange={(e) => updateSettings({ language: e.target.value })}
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-slate-950/70 border border-slate-700/80 rounded-lg text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Proxy VPN (opsional)
                </span>
                <input
                  type="text"
                  value={settings.proxy}
                  onChange={(e) => updateSettings({ proxy: e.target.value })}
                  disabled={isLoading}
                  placeholder="socks5://127.0.0.1:1080"
                  className="w-full px-3 py-2 bg-slate-950/70 border border-slate-700/80 rounded-lg text-xs text-slate-100 placeholder-slate-600 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </label>

              <p className="sm:col-span-2 text-[11px] text-slate-500 leading-relaxed">
                Bila VPN sudah aktif di komputer/server tempat aplikasi ini berjalan, kosongkan proxy — semua unduhan otomatis
                lewat VPN. Isi proxy bila aplikasi VPN menyediakan proxy lokal (SOCKS5/HTTP) atau server berjalan di mesin lain.
              </p>
            </div>
          )}
        </div>

        {/* Loading Progress Bar */}
        {isLoading && (
          <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-indigo-500/20 animate-pulse">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-medium text-indigo-300 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                {statusMessage || 'Sedang mengekstrak audio & menjalankan transkripsi...'}
              </span>
              <span className="font-mono text-slate-400">{progressPercentage}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-amber-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.max(5, progressPercentage)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Transkripsi berjalan di CPU server; video panjang bisa memerlukan beberapa menit. Halaman ini boleh dibiarkan terbuka.
            </p>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Terjadi Kesalahan</p>
              <p className="text-red-200/90 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}
      </div>

      {/* Shared videos owned by this browser */}
      {myShares.length > 0 && (
        <div className="mt-8">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Video Saya (dibagikan)</span>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {myShares.slice(0, 8).map((s) => (
              <a
                key={s.id}
                href={`/d/${s.id}`}
                className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all flex items-center gap-3"
              >
                <Share2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">{s.title}</p>
                  <p className="text-[10px] text-slate-500 font-mono">/d/{s.id}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Quick Demo Samples */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Atau Coba Contoh Langsung (1-Klik Tanpa Mengetik):
          </span>
          <span className="text-xs text-indigo-400 font-medium">Siap Diuji</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {SAMPLE_VIDEOS.map((sample) => (
            <div
              key={sample.id}
              onClick={() => !isLoading && onSelectSample(sample)}
              className="group p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer flex gap-3.5 items-center"
            >
              <div className="relative w-20 h-14 rounded-lg overflow-hidden shrink-0 bg-slate-950">
                <img
                  src={sample.metadata.thumbnailUrl}
                  alt={sample.metadata.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                  <Play className="w-4 h-4 text-white fill-white/80" />
                </div>
                <span className="absolute bottom-1 right-1 text-[9px] font-mono px-1 py-0.2 rounded bg-black/70 text-slate-200">
                  {sample.metadata.duration}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 truncate transition-colors">
                  {sample.metadata.title}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{sample.metadata.author}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Transkrip + Ringkasan
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
