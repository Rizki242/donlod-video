import React, { useState } from 'react';
import {
  X,
  Download,
  FileText,
  Subtitles,
  FileCode,
  FileJson,
  Check,
  Film,
  Music,
  Printer,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { VideoMetadata, VideoSummary, TranscriptSegment } from '../types';
import {
  generatePdf,
  generateSrt,
  generateVtt,
  generateMarkdown,
  generateTxt,
  generateJson,
  downloadFile,
} from '../utils/exportFormats';

interface ExportCenterProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: VideoMetadata;
  summary: VideoSummary | null;
  segments: TranscriptSegment[];
}

export const ExportCenter: React.FC<ExportCenterProps> = ({
  isOpen,
  onClose,
  metadata,
  summary,
  segments,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const baseFilename = metadata.title.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 35);

  const handleExport = (format: 'pdf' | 'srt' | 'vtt' | 'md' | 'txt' | 'json') => {
    switch (format) {
      case 'pdf':
        generatePdf(metadata, summary, segments);
        break;
      case 'srt':
        const srtContent = generateSrt(segments);
        downloadFile(srtContent, `${baseFilename}_Subtitle.srt`, 'text/plain');
        break;
      case 'vtt':
        const vttContent = generateVtt(segments);
        downloadFile(vttContent, `${baseFilename}_Subtitle.vtt`, 'text/vtt');
        break;
      case 'md':
        const mdContent = generateMarkdown(metadata, summary, segments);
        downloadFile(mdContent, `${baseFilename}_Ringkasan.md`, 'text/markdown');
        break;
      case 'txt':
        const txtContent = generateTxt(metadata, summary, segments);
        downloadFile(txtContent, `${baseFilename}_Ringkasan.txt`, 'text/plain');
        break;
      case 'json':
        const jsonContent = generateJson(metadata, summary, segments);
        downloadFile(jsonContent, `${baseFilename}_Data.json`, 'application/json');
        break;
    }

    setDownloadSuccess(format);
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const handleDownloadMedia = (type: 'video' | 'audio') => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-amber-500 p-0.5">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Download className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Pusat Ekspor & Unduhan</h3>
              <p className="text-xs text-slate-400">
                Pilih format dokumen laporan ringkasan atau subtitle video
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {/* Target Video Preview */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
            <Film className="w-5 h-5 text-indigo-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-semibold text-white truncate">{metadata.title}</h4>
              <p className="text-[11px] text-slate-500">
                {segments.length} segmen transkrip • {metadata.author}
              </p>
            </div>
          </div>

          {/* Document & Subtitle Formats Grid */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Format Dokumen & Subtitle Teks:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* PDF Format */}
              <button
                onClick={() => handleExport('pdf')}
                className="p-4 rounded-2xl bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all text-left group flex items-start justify-between cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                        Laporan PDF
                      </span>
                      <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        Populer
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Dokumen lengkap: Ringkasan eksekutif, poin penting, alur babak, & transkrip.
                    </p>
                  </div>
                </div>
                {downloadSuccess === 'pdf' ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Download className="w-4 h-4 text-slate-500 group-hover:text-slate-300 shrink-0" />
                )}
              </button>

              {/* SRT Subtitle Format */}
              <button
                onClick={() => handleExport('srt')}
                className="p-4 rounded-2xl bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all text-left group flex items-start justify-between cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                    <Subtitles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                        Subtitle SRT (.srt)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Format standar SubRip dengan millisecond timestamps untuk YouTube & media player.
                    </p>
                  </div>
                </div>
                {downloadSuccess === 'srt' ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Download className="w-4 h-4 text-slate-500 group-hover:text-slate-300 shrink-0" />
                )}
              </button>

              {/* VTT Subtitle Format */}
              <button
                onClick={() => handleExport('vtt')}
                className="p-4 rounded-2xl bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all text-left group flex items-start justify-between cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0 group-hover:scale-105 transition-transform">
                    <Subtitles className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      WebVTT (.vtt)
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Standar web subtitle modern untuk HTML5 video dan web streaming.
                    </p>
                  </div>
                </div>
                {downloadSuccess === 'vtt' ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Download className="w-4 h-4 text-slate-500 group-hover:text-slate-300 shrink-0" />
                )}
              </button>

              {/* Markdown Format */}
              <button
                onClick={() => handleExport('md')}
                className="p-4 rounded-2xl bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all text-left group flex items-start justify-between cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      Markdown (.md)
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Format rapi untuk Notion, Obsidian, GitHub README, dan catatan riset.
                    </p>
                  </div>
                </div>
                {downloadSuccess === 'md' ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Download className="w-4 h-4 text-slate-500 group-hover:text-slate-300 shrink-0" />
                )}
              </button>

              {/* Plain Text TXT */}
              <button
                onClick={() => handleExport('txt')}
                className="p-4 rounded-2xl bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all text-left group flex items-start justify-between cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      Teks Polos (.txt)
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      File teks murni tanpa format, kompatibel dengan semua aplikasi teks.
                    </p>
                  </div>
                </div>
                {downloadSuccess === 'txt' ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Download className="w-4 h-4 text-slate-500 group-hover:text-slate-300 shrink-0" />
                )}
              </button>

              {/* JSON Format */}
              <button
                onClick={() => handleExport('json')}
                className="p-4 rounded-2xl bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all text-left group flex items-start justify-between cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
                    <FileJson className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      Skema JSON (.json)
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Struktur data terprogram dengan segmen, timestamps, dan kesimpulan.
                    </p>
                  </div>
                </div>
                {downloadSuccess === 'json' ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Download className="w-4 h-4 text-slate-500 group-hover:text-slate-300 shrink-0" />
                )}
              </button>
            </div>
          </div>

          {/* Media Download Options */}
          <div className="pt-3 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Unduh File Media Sumber:
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Film className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    {metadata.type === 'youtube' ? 'Simpan / Unduh Video YouTube' : 'Unduh Video Asli (MP4)'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {metadata.type === 'youtube' ? 'Buka tautan resolusi asli atau simpan media' : 'Format original tersimpan'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDownloadMedia('video')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Unduh File</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Dihasilkan oleh VideoScribe (Whisper lokal & ringkasan ekstraktif)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
