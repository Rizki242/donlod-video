import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { VideoInputSection } from './components/VideoInputSection';
import { VideoPlayerView } from './components/VideoPlayerView';
import { SummaryView } from './components/SummaryView';
import { TranscriptView } from './components/TranscriptView';
import { TranscriptSearchView } from './components/TranscriptSearchView';
import { VideoDownloadView } from './components/VideoDownloadView';
import { ExportCenter } from './components/ExportCenter';
import { VideoMetadata, VideoSummary, TranscriptSegment } from './types';
import { fetchVideoInfo, postJson, transcribeFromFile, transcribeFromUrl } from './utils/jobs';
import { SampleVideoItem } from './data/sampleVideos';
import {
  Sparkles,
  FileText,
  Subtitles,
  Search,
  Download,
  AlertCircle,
  CheckCircle2,
  Share2,
} from 'lucide-react';

function formatSeconds(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = Math.floor(total % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export default function App() {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [summary, setSummary] = useState<VideoSummary | null>(null);

  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'search' | 'download'>('summary');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [progressPercentage, setProgressPercentage] = useState(0);

  const [seekTime, setSeekTime] = useState<number | null>(null);
  const [currentPlayTime, setCurrentPlayTime] = useState(0);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Ringkasan otomatis ekstraktif (tanpa LLM) dari segmen transkrip
  const requestSummary = async (transcriptSegments: TranscriptSegment[], title: string, style = 'standard') => {
    setIsSummarizing(true);
    try {
      const data = await postJson('/api/summarize', {
        segments: transcriptSegments,
        title,
        summaryStyle: style,
      });
      setSummary(data.summary);
    } catch (err: any) {
      console.error('Summary error:', err);
      showToast(`Gagal merangkum: ${err.message}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  // 1. Process YouTube / web video URL
  const handleProcessUrl = async (url: string) => {
    setIsProcessing(true);
    setProgressPercentage(5);
    setStatusMessage('Mendeteksi metadata video, format unduhan, dan subtitle...');

    try {
      const data = await fetchVideoInfo(url);

      const newMeta: VideoMetadata = {
        type: data.type || 'youtube',
        videoId: data.videoId,
        title: data.title,
        author: data.author,
        thumbnailUrl: data.thumbnailUrl,
        duration: data.duration || 'Otomatis',
        durationSeconds: data.durationSeconds,
        url: data.url,
        captionsAvailable: data.captionsAvailable,
        downloadOptions: data.downloadOptions,
      };

      let newSegments: TranscriptSegment[];

      if (data.captionsAvailable && data.segments?.length > 0) {
        setStatusMessage('Subtitle terdeteksi! Menyusun transkrip per detik...');
        setProgressPercentage(60);
        newSegments = data.segments;
        newMeta.transcriptSource = 'captions';
      } else {
        // Tidak ada subtitle: server mengunduh audio lalu Whisper lokal mengubahnya ke teks
        const result = await transcribeFromUrl(data.url, data.title, (p, msg) => {
          setStatusMessage(msg);
          setProgressPercentage(10 + Math.round(p * 0.8));
        });
        if (result.segments.length === 0) {
          throw new Error('Tidak ada ucapan yang terdeteksi di audio video ini.');
        }
        newSegments = result.segments;
        newMeta.transcriptSource = 'ai';
      }

      setMetadata(newMeta);
      setSegments(newSegments);
      setSummary(null);
      setActiveTab('summary');

      setStatusMessage('Membuat ringkasan eksekutif dan poin-poin penting...');
      setProgressPercentage(92);
      await requestSummary(newSegments, newMeta.title);
      setProgressPercentage(100);
    } catch (err: any) {
      console.error('Process URL error:', err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Process local file upload (video or audio up to 180 min)
  const handleProcessFile = async (file: File) => {
    setIsProcessing(true);
    setProgressPercentage(0);
    setStatusMessage('Mengunggah file ke server...');

    try {
      const result = await transcribeFromFile(file, (p, msg) => {
        setStatusMessage(msg);
        setProgressPercentage(Math.round(p * 0.9));
      });
      if (result.segments.length === 0) {
        throw new Error('Tidak ada ucapan yang terdeteksi di file ini.');
      }

      const newMeta: VideoMetadata = {
        type: 'upload',
        title: file.name.replace(/\.[^/.]+$/, ''),
        author: 'File Unggahan Lokal',
        fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        localFileUrl: URL.createObjectURL(file),
        file,
        duration: result.durationSeconds ? formatSeconds(result.durationSeconds) : 'Otomatis',
        durationSeconds: result.durationSeconds,
        transcriptSource: 'ai',
      };

      setMetadata(newMeta);
      setSegments(result.segments);
      setSummary(null);
      setActiveTab('summary');

      setStatusMessage('Menyusun ringkasan dan poin penting...');
      setProgressPercentage(92);
      await requestSummary(result.segments, newMeta.title);
      setProgressPercentage(100);
      showToast(`Transkripsi selesai (${result.detectedLanguage}, ${result.segments.length} segmen)`);
    } catch (err: any) {
      console.error('Process file error:', err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  // 2b. Transkrip ulang dari audio asli (dipakai dari tab Unduh, mis. bila subtitle kurang akurat)
  const handleTranscribeSource = async (onProgress: (p: number, msg: string) => void) => {
    if (!metadata?.url) return;
    const result = await transcribeFromUrl(metadata.url, metadata.title, onProgress);
    if (result.segments.length === 0) {
      throw new Error('Tidak ada ucapan yang terdeteksi di audio video ini.');
    }
    setSegments(result.segments);
    setMetadata((prev) => (prev ? { ...prev, transcriptSource: 'ai' } : prev));
    showToast(`Transkripsi selesai (${result.detectedLanguage}, ${result.segments.length} segmen)`);
    await requestSummary(result.segments, metadata.title);
  };

  // 3. Select Sample Demo
  const handleSelectSample = (sample: SampleVideoItem) => {
    setMetadata(sample.metadata);
    setSegments(sample.segments);
    setSummary(sample.summary);
    setActiveTab('summary');
    showToast(`Memuat demo: "${sample.metadata.title}"`);
  };

  // 4. Seek to seconds in video
  const handleSeekTo = (seconds: number) => {
    setSeekTime(seconds);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 5. Update segment text/speaker
  const handleUpdateSegment = (id: number, newText: string, newSpeaker: string) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text: newText, speaker: newSpeaker } : s))
    );
    showToast('Segmen transkrip diperbarui');
  };

  // 6. Reset all to start over
  const handleReset = () => {
    if (metadata?.localFileUrl) URL.revokeObjectURL(metadata.localFileUrl);
    setMetadata(null);
    setSegments([]);
    setSummary(null);
    setActiveTab('summary');
    setSeekTime(null);
    setCurrentPlayTime(0);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Navbar */}
      <Navbar
        onReset={handleReset}
        hasActiveVideo={!!metadata}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!metadata ? (
          /* Input / Upload screen */
          <VideoInputSection
            onProcessUrl={handleProcessUrl}
            onProcessFile={handleProcessFile}
            onSelectSample={handleSelectSample}
            isLoading={isProcessing}
            statusMessage={statusMessage}
            progressPercentage={progressPercentage}
          />
        ) : (
          /* Active Video Workspace */
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Video Player & Quick Action Bar */}
            <VideoPlayerView
              metadata={metadata}
              seekTime={seekTime}
              onTimeUpdate={(t) => setCurrentPlayTime(t)}
              onOpenExportModal={() => setIsExportOpen(true)}
              onNavigateToDownload={() => setActiveTab('download')}
            />

            {/* Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 overflow-x-auto">
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'summary'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Ringkasan & Poin Penting</span>
                </button>

                <button
                  onClick={() => setActiveTab('transcript')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'transcript'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Subtitles className="w-4 h-4 text-indigo-300" />
                  <span>Transkrip Suara ({segments.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('download')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'download'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Unduh Video & Audio</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                    MP4 / MP3
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('search')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'search'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Search className="w-4 h-4 text-violet-300" />
                  <span>Cari di Transkrip</span>
                </button>

                <button
                  onClick={() => setIsExportOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>Ekspor (PDF / SRT)</span>
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                <span className="font-mono">{segments.length} segmen</span>
                <span>•</span>
                <span className="text-emerald-400 font-medium">Durasi s/d 180 Menit</span>
              </div>
            </div>

            {/* Tab Panels */}
            {activeTab === 'summary' && (
              <SummaryView
                summary={summary}
                isLoading={isSummarizing}
                onReSummarize={(style) =>
                  requestSummary(segments, metadata.title, style)
                }
                onSeekTo={handleSeekTo}
              />
            )}

            {activeTab === 'transcript' && (
              <TranscriptView
                segments={segments}
                currentPlayTime={currentPlayTime}
                onSeekTo={handleSeekTo}
                onUpdateSegment={handleUpdateSegment}
                onOpenExportModal={() => setIsExportOpen(true)}
              />
            )}

            {activeTab === 'download' && (
              <VideoDownloadView
                metadata={metadata}
                segments={segments}
                summary={summary}
                onOpenExportModal={() => setIsExportOpen(true)}
                onToast={showToast}
                onTranscribeSource={handleTranscribeSource}
              />
            )}

            {activeTab === 'search' && (
              <TranscriptSearchView segments={segments} onSeekTo={handleSeekTo} />
            )}
          </div>
        )}
      </main>

      {/* Export Modal */}
      {metadata && (
        <ExportCenter
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          metadata={metadata}
          summary={summary}
          segments={segments}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900 border border-indigo-500/40 text-slate-100 text-xs font-semibold shadow-2xl animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} VideoScribe. Unduh & transkripsi video, diproses sepenuhnya di server sendiri.</p>
          <p className="text-slate-500">Mendukung format MP4, WebM, MKV, MP3, WAV, M4A, FLAC, PDF & SRT</p>
        </div>
      </footer>
    </div>
  );
}
