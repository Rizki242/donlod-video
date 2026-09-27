import React from 'react';
import { Video, Sparkles, Clock, FileText, Download } from 'lucide-react';

interface NavbarProps {
  onReset: () => void;
  hasActiveVideo: boolean;
  onOpenExport?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onReset, hasActiveVideo, onOpenExport }) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div 
          onClick={onReset}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-amber-500 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Video className="w-5 h-5 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-200">
                VideoScribe AI
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                v2.5
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Unduh, Transkrip Suara & Ringkas Video hingga 180 Menit
            </p>
          </div>
        </div>

        {/* Center / Right Badges */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Maks. 180 Menit</span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-800/40 text-xs text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Whisper Lokal • Tanpa LLM</span>
          </div>

          {hasActiveVideo && onOpenExport && (
            <button
              onClick={onOpenExport}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all hover:scale-102 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor (PDF / SRT)</span>
            </button>
          )}

          {hasActiveVideo && (
            <button
              onClick={onReset}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Video Baru
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
