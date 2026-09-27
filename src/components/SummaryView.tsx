import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle,
  Clock,
  Tag,
  Copy,
  Check,
  HelpCircle,
  TrendingUp,
  Users,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  BookOpen,
  ListOrdered,
  FileCheck,
} from 'lucide-react';
import { VideoSummary } from '../types';

interface SummaryViewProps {
  summary: VideoSummary | null;
  isLoading: boolean;
  onReSummarize: (style: string) => Promise<void>;
  onSeekTo: (seconds: number) => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  summary,
  isLoading,
  onReSummarize,
  onSeekTo,
}) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [checkedActions, setCheckedActions] = useState<Record<number, boolean>>({});
  const [expandedFaq, setExpandedFaq] = useState<Record<number, boolean>>({});
  const [summaryStyle, setSummaryStyle] = useState('standard');

  const copyToClipboard = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const toggleAction = (idx: number) => {
    setCheckedActions((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleFaq = (idx: number) => {
    setExpandedFaq((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Parse "MM:SS" or "HH:MM:SS" into total seconds
  const parseTimestamp = (timeStr?: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  if (!summary && isLoading) {
    return (
      <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
        <Sparkles className="w-10 h-10 text-indigo-400 mx-auto animate-pulse mb-3" />
        <h3 className="text-base font-semibold text-white">Merangkum Poin-Poin Penting Video...</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Menganalisis kata kunci transkrip untuk memilih kalimat terpenting, babak waktu, dan saran praktis.
        </p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
        <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-white">Belum Ada Ringkasan</h3>
        <p className="text-xs text-slate-400 mt-1 mb-4">
          Klik tombol di bawah untuk membuat ringkasan komprehensif dari transkrip yang ada.
        </p>
        <button
          onClick={() => onReSummarize('standard')}
          disabled={isLoading}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20"
        >
          <Sparkles className="w-4 h-4" />
          <span>Buat Ringkasan Sekarang</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Control bar: Style switch & Regenerate */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Model Gaya:</span>
          <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {[
              { id: 'standard', label: 'Lengkap & Eksekutif' },
              { id: 'bullet_points', label: 'Poin-Poin Kunci' },
              { id: 'study_notes', label: 'Catatan Belajar / Kuliah' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setSummaryStyle(item.id);
                  onReSummarize(item.id);
                }}
                disabled={isLoading}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  summaryStyle === item.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onReSummarize(summaryStyle)}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Segarkan Analisis</span>
        </button>
      </div>

      {/* 1. Executive Summary Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md relative group">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">Ringkasan Eksekutif</h3>
          </div>
          <button
            onClick={() => copyToClipboard(summary.executiveSummary, 'exec')}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
            title="Salin Ringkasan"
          >
            {copiedSection === 'exec' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="text-[11px]">{copiedSection === 'exec' ? 'Tersalin' : 'Salin'}</span>
          </button>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed font-normal">
          {summary.executiveSummary}
        </p>

        {/* Tone and Audience tags */}
        {summary.sentimentAndKeywords && (
          <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-950 text-indigo-300 border border-slate-800 text-[11px]">
              <TrendingUp className="w-3 h-3 text-indigo-400" />
              <span>Nada: {summary.sentimentAndKeywords.tone}</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-950 text-amber-300 border border-slate-800 text-[11px]">
              <Users className="w-3 h-3 text-amber-400" />
              <span>Audiens: {summary.sentimentAndKeywords.targetAudience}</span>
            </div>
            {summary.sentimentAndKeywords.keywords?.slice(0, 4).map((kw, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md bg-slate-800/50 text-slate-400 text-[10px]"
              >
                #{kw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2. Key Takeaways Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Poin-Poin Penting & Wawasan Kunci</h3>
              <p className="text-xs text-slate-400">Temuan utama yang dapat dipelajari dari materi video</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
            {summary.keyTakeaways?.length || 0} Poin
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {summary.keyTakeaways?.map((item, index) => (
            <div
              key={index}
              className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {item.category}
                  </span>
                  {item.timestamp && (
                    <button
                      onClick={() => onSeekTo(parseTimestamp(item.timestamp))}
                      className="text-[11px] font-mono text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                      title="Lompat ke video di menit ini"
                    >
                      <Clock className="w-3 h-3" />
                      <span>{item.timestamp}</span>
                    </button>
                  )}
                </div>
                <h4 className="text-xs sm:text-sm font-semibold text-slate-100 mt-1">
                  {item.point}
                </h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-normal">
                  {item.explanation}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Chapters / Timeline Breakdown */}
      {summary.chapters && summary.chapters.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Alur Babak Video (Timeline & Chapters)</h3>
              <p className="text-xs text-slate-400">
                Klik stempel waktu untuk memutar video langsung ke bagian tersebut
              </p>
            </div>
          </div>

          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {summary.chapters.map((ch, idx) => {
              const seconds = ch.startSeconds ?? parseTimestamp(ch.timestamp);
              return (
                <div key={idx} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-indigo-500 group-hover:scale-125 transition-transform" />

                  <div
                    onClick={() => onSeekTo(seconds)}
                    className="p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-indigo-500/40 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        {ch.timestamp}
                      </span>
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">
                        {ch.title}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-400 pl-0.5">{ch.summary}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Action Items Checklist */}
      {summary.actionItems && summary.actionItems.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Rekomendasi Tindakan Nyata (Action Items)</h3>
                <p className="text-xs text-slate-400">Langkah implementasi praktis yang disarankan materi</p>
              </div>
            </div>
            <span className="text-xs text-slate-400">
              {Object.values(checkedActions).filter(Boolean).length} / {summary.actionItems.length} selesai
            </span>
          </div>

          <div className="space-y-2">
            {summary.actionItems.map((action, idx) => {
              const isChecked = !!checkedActions[idx];
              return (
                <div
                  key={idx}
                  onClick={() => toggleAction(idx)}
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-400 line-through'
                      : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded mt-0.5 shrink-0 flex items-center justify-center border transition-colors ${
                      isChecked
                        ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                        : 'border-slate-600 hover:border-indigo-400'
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="text-xs sm:text-sm font-medium leading-relaxed">{action}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Key FAQ Section */}
      {summary.faq && summary.faq.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Tanya Jawab Kunci (FAQ)</h3>
              <p className="text-xs text-slate-400">Pertanyaan umum yang terjawab langsung di dalam video</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {summary.faq.map((item, idx) => {
              const isOpen = !!expandedFaq[idx];
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-3.5 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold text-slate-200 hover:text-indigo-300 transition-colors"
                  >
                    <span>{item.question}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-3.5 pb-3.5 pt-1 text-xs text-slate-400 border-t border-slate-800/60 leading-relaxed">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
