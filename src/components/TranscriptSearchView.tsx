import React, { useState } from 'react';
import { Search, Loader2, PlayCircle, AlertCircle } from 'lucide-react';
import { TranscriptSegment } from '../types';
import { postJson } from '../utils/jobs';

interface TranscriptSearchViewProps {
  segments: TranscriptSegment[];
  onSeekTo: (seconds: number) => void;
}

interface SearchResult {
  startSeconds: number;
  timestamp: string;
  text: string;
  score: number;
}

/** Tandai kata yang dicari di dalam teks hasil. */
function highlight(text: string, query: string): React.ReactNode {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (terms.length === 0) return text;
  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  return text.split(regex).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-amber-400/25 text-amber-200 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export const TranscriptSearchView: React.FC<TranscriptSearchViewProps> = ({ segments, onSeekTo }) => {
  const [query, setQuery] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q || isLoading) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await postJson<{ results: SearchResult[] }>('/api/search', { segments, query: q, limit: 8 });
      setResults(data.results);
      setLastQuery(q);
    } catch (err: any) {
      setError(err.message || 'Gagal mencari.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-300">
          <Search className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Cari di Transkrip</h3>
          <p className="text-[11px] text-slate-400">
            Temukan bagian video yang membahas kata atau topik tertentu, lalu lompat ke detiknya
          </p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="p-4 flex items-center gap-2 border-b border-slate-800">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ketik kata kunci, mis. harga, strategi pemasaran, kesimpulan..."
          className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          <span>Cari</span>
        </button>
      </form>

      <div className="p-4 space-y-3 min-h-[240px] max-h-[520px] overflow-y-auto">
        {error && (
          <p className="text-xs text-red-300 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </p>
        )}

        {results === null && !error && (
          <p className="text-xs text-slate-500 text-center pt-16">
            Masukkan kata kunci untuk mencari di {segments.length} segmen transkrip.
          </p>
        )}

        {results?.length === 0 && (
          <p className="text-xs text-slate-400 text-center pt-16">
            Tidak ada bagian yang membahas "<strong>{lastQuery}</strong>". Coba kata lain atau sinonimnya.
          </p>
        )}

        {results?.map((r) => (
          <button
            key={r.startSeconds}
            onClick={() => onSeekTo(r.startSeconds)}
            className="w-full text-left p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-violet-500/40 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <PlayCircle className="w-4 h-4 text-violet-400 group-hover:text-violet-300" />
              <span className="text-xs font-mono font-semibold text-violet-300">{r.timestamp}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{highlight(r.text, lastQuery)}</p>
          </button>
        ))}
      </div>
    </div>
  );
};
