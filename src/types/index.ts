export interface TranscriptSegment {
  id: number;
  start: string;
  end: string;
  startSeconds: number;
  endSeconds: number;
  speaker: string;
  text: string;
}

export interface KeyTakeaway {
  point: string;
  explanation: string;
  category: string;
  timestamp?: string;
}

export interface Chapter {
  timestamp: string;
  startSeconds?: number;
  title: string;
  summary: string;
}

export interface VideoSummary {
  title: string;
  executiveSummary: string;
  keyTakeaways: KeyTakeaway[];
  chapters: Chapter[];
  actionItems: string[];
  faq: Array<{ question: string; answer: string }>;
  sentimentAndKeywords: {
    sentiment: string;
    tone: string;
    keywords: string[];
    targetAudience: string;
  };
}

export interface VideoDownloadOption {
  label: string;
  resolution: string;
  format: string;
  quality: string;
  sizeEstimate?: string;
  type: 'video' | 'audio';
  /** Preset unduhan server (mis. "video-720", "audio-mp3") */
  preset?: string;
  /** 'server' = diunduh oleh sistem pengunduh internal, 'local' = file upload pengguna */
  actionType: 'server' | 'local';
}

export interface VideoMetadata {
  type: 'youtube' | 'web_video' | 'upload';
  url?: string;
  videoId?: string;
  title: string;
  author: string;
  thumbnailUrl?: string;
  duration?: string;
  durationSeconds?: number;
  fileSize?: string;
  localFileUrl?: string;
  file?: File;
  captionsAvailable?: boolean;
  /** Asal transkrip: subtitle bawaan sumber atau hasil transkripsi AI dari audio */
  transcriptSource?: 'captions' | 'ai';
  downloadOptions?: VideoDownloadOption[];
}

