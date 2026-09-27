import React, { useState, useMemo } from 'react';
import {
  Search,
  Clock,
  User,
  Copy,
  Check,
  Edit2,
  CheckSquare,
  Sparkles,
  Download,
  Filter,
} from 'lucide-react';
import { TranscriptSegment } from '../types';

interface TranscriptViewProps {
  segments: TranscriptSegment[];
  currentPlayTime: number;
  onSeekTo: (seconds: number) => void;
  onUpdateSegment?: (id: number, newText: string, newSpeaker: string) => void;
  onOpenExportModal: () => void;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  segments,
  currentPlayTime,
  onSeekTo,
  onUpdateSegment,
  onOpenExportModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editSpeaker, setEditSpeaker] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Filtered segments based on search
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const q = searchQuery.toLowerCase();
    return segments.filter(
      (s) =>
        s.text.toLowerCase().includes(q) ||
        (s.speaker && s.speaker.toLowerCase().includes(q)) ||
        s.start.includes(q)
    );
  }, [segments, searchQuery]);

  // Total stats
  const totalWords = useMemo(() => {
    return segments.reduce((acc, s) => acc + s.text.split(/\s+/).filter(Boolean).length, 0);
  }, [segments]);

  const readingTimeMinutes = Math.max(1, Math.round(totalWords / 180));

  const handleStartEdit = (seg: TranscriptSegment) => {
    setEditingId(seg.id);
    setEditText(seg.text);
    setEditSpeaker(seg.speaker || 'Speaker');
  };

  const handleSaveEdit = (id: number) => {
    onUpdateSegment?.(id, editText, editSpeaker);
    setEditingId(null);
  };

  const handleCopySegment = (seg: TranscriptSegment) => {
    const content = `[${seg.start}] ${seg.speaker ? seg.speaker + ': ' : ''}${seg.text}`;
    navigator.clipboard.writeText(content);
    setCopiedId(seg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const full = segments
      .map((s) => `[${s.start} - ${s.end}] ${s.speaker ? s.speaker + ': ' : ''}${s.text}`)
      .join('\n\n');
    navigator.clipboard.writeText(full);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Highlight search matches
  const renderHighlightedText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-amber-400 text-slate-950 font-semibold px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Top Header & Search Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kata kunci di transkrip..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <span className="text-xs text-slate-400 hidden md:inline">
            {filteredSegments.length} / {segments.length} segmen
          </span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="text-[11px] text-slate-400 hidden lg:flex items-center gap-2 mr-2">
            <span>{totalWords.toLocaleString()} kata</span>
            <span>•</span>
            <span>~{readingTimeMinutes} mnt baca</span>
          </div>

          <button
            onClick={handleCopyAll}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAll ? 'Tersalin!' : 'Salin Semua'}</span>
          </button>

          <button
            onClick={onOpenExportModal}
            className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Ekspor SRT</span>
          </button>
        </div>
      </div>

      {/* Segments List */}
      <div className="divide-y divide-slate-800/60 max-h-[600px] overflow-y-auto p-2 sm:p-3">
        {filteredSegments.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Tidak ditemukan segmen dengan kata kunci "{searchQuery}".
          </div>
        ) : (
          filteredSegments.map((seg) => {
            const isEditing = editingId === seg.id;
            const isActive =
              currentPlayTime >= seg.startSeconds && currentPlayTime <= seg.endSeconds;

            return (
              <div
                key={seg.id}
                className={`p-3 sm:p-4 rounded-xl transition-all group ${
                  isActive
                    ? 'bg-indigo-950/30 border border-indigo-500/30'
                    : 'hover:bg-slate-950/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSeekTo(seg.startSeconds)}
                      className="px-2 py-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 font-mono text-[11px] font-semibold border border-indigo-500/20 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Klik untuk memutar video dari detik ini"
                    >
                      <Clock className="w-3 h-3" />
                      <span>{seg.start}</span>
                    </button>

                    {isEditing ? (
                      <input
                        type="text"
                        value={editSpeaker}
                        onChange={(e) => setEditSpeaker(e.target.value)}
                        placeholder="Nama Pembicara"
                        className="px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" />
                        <span>{seg.speaker || 'Speaker'}</span>
                      </span>
                    )}
                  </div>

                  {/* Actions for segment */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    {isEditing ? (
                      <button
                        onClick={() => handleSaveEdit(seg.id)}
                        className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <CheckSquare className="w-3 h-3" />
                        <span>Simpan</span>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEdit(seg)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                          title="Edit teks segmen ini"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopySegment(seg)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                          title="Salin segmen ini"
                        >
                          {copiedId === seg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Text Content */}
                {isEditing ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className="w-full mt-1 p-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                ) : (
                  <p
                    onClick={() => onSeekTo(seg.startSeconds)}
                    className="text-xs sm:text-sm text-slate-300 leading-relaxed cursor-pointer hover:text-white transition-colors"
                  >
                    {renderHighlightedText(seg.text, searchQuery)}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
