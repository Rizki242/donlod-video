/**
 * Ringkasan ekstraktif tanpa LLM: memilih kalimat terpenting dari transkrip
 * berdasarkan bobot kata kunci (TF-IDF), lalu menyusun bab, poin aksi, dan tanya-jawab
 * dari kalimat asli beserta timestamp-nya.
 */
import { formatTime, type TranscriptSegment } from './transcribe.ts';

export interface SummaryData {
  title: string;
  executiveSummary: string;
  keyTakeaways: Array<{ point: string; explanation: string; category: string; timestamp?: string }>;
  chapters: Array<{ timestamp: string; startSeconds?: number; title: string; summary: string }>;
  actionItems: string[];
  faq: Array<{ question: string; answer: string }>;
  sentimentAndKeywords: { sentiment: string; tone: string; keywords: string[]; targetAudience: string };
}

const STOPWORDS = new Set(
  `yang dan di ke dari ini itu dengan untuk pada adalah dalam tidak akan juga atau karena jadi kita kami saya aku kamu anda dia mereka
  ada bisa sudah belum lagi saja hanya sangat lebih paling masih harus perlu kalau jika agar supaya seperti bahwa oleh para tersebut
  sebuah suatu satu dua tiga banyak semua setiap tapi tetapi namun maka lalu kemudian sambil sehingga ketika saat sebagai secara
  apa siapa mana kapan bagaimana mengapa kenapa berapa apakah iya ya tidak nggak gak enggak ga kok sih dong deh nih tuh lah kan pun
  gitu gini begitu begini sini situ sana nah oke ok eh eee hmm aja udah udh mau ingin sedang telah pernah dapat bagi antara hingga
  sampai tentang tanpa selalu sering biasanya mungkin memang benar kayak kaya banget gue gua lo lu elo kalian kamu punya buat bikin
  terus jadi nya kah pula yaitu yakni ialah merupakan sendiri sama lain the a an and or but of to in on at for with is are was were be been
  being this that these those it its i you he she we they them me my your our their his her not no yes do does did have has had will would
  can could should just so very really like get got go going know think what which who when where why how there here then than also
  about from into out up down over all some any more most other such only own same too um uh okay yeah right well gonna wanna
  terjadi hal orang beberapa kali cara sesuatu seseorang tahun waktu hari bagian memiliki membuat melakukan menjadi mengatakan
  bilang tahu lihat melihat apapun kembali baru sekarang nanti tadi bahkan tentu sekitar hampir cukup begitulah yah
  tak takkan hal-hal thing things people time way something one make made say said see look want back now even much many`
    .split(/\s+/)
    .filter(Boolean)
);

// Poin aksi: kalimat perintah, atau anjuran yang ditujukan ke pendengar
const IMPERATIVE_START =
  /^(jangan|pastikan|cobalah|coba|lakukan|gunakan|mulailah|mulai|ayo|mari|ingatlah|ingat|hindari|siapkan|catat|make sure|don't|do not|try|remember|avoid|start|stop|always|never)\b/i;
const MODAL = /\b(harus|perlu|wajib|sebaiknya|disarankan|should|must|need to|have to)\b/i;
const LISTENER = /\b(anda|kamu|kita|kalian|you|we)\b/i;
const isActionSentence = (text: string) =>
  !/\?\s*$/.test(text) && (IMPERATIVE_START.test(text) || (MODAL.test(text) && LISTENER.test(text)));
const QUESTION_START =
  /^(apa|apakah|bagaimana|gimana|mengapa|kenapa|kapan|di ?mana|siapa|berapa|bisakah|what|why|how|when|where|who|is|are|can|do|does)\b/i;
const POSITIVE = new Set(
  'baik bagus hebat mantap keren senang suka sukses berhasil mudah untung manfaat bermanfaat positif luar biasa terbaik efektif efisien cinta bahagia menarik good great awesome amazing love happy success easy best benefit excellent nice positive'.split(' ')
);
const NEGATIVE = new Set(
  'buruk jelek gagal sulit susah rugi masalah bahaya berbahaya sedih marah takut kecewa negatif salah kurang lemah risiko ancaman bad fail failure hard difficult problem danger sad angry fear wrong worse worst risk negative'.split(' ')
);
const CASUAL = /\b(gue|gua|lo|lu|banget|nih|sih|dong|deh|kok|gitu|nggak|gak|kayak)\b/i;

interface Sentence {
  text: string;
  startSeconds: number;
  words: string[];
  score: number;
  index: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

/** Gabungkan segmen (sering berupa potongan frasa) menjadi kalimat utuh. */
function buildSentences(segments: TranscriptSegment[]): Sentence[] {
  const sentences: Sentence[] = [];
  let buffer = '';
  let start = 0;

  const flush = () => {
    // Buang keterangan panggung seperti "(Tertawa)", "[Musik]", "♪"
    const text = buffer
      .replace(/\([^)]{0,40}\)|\[[^\]]{0,40}\]|[♪♫]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.split(' ').length >= 4) {
      sentences.push({ text, startSeconds: start, words: tokenize(text), score: 0, index: sentences.length });
    }
    buffer = '';
  };

  for (const seg of segments) {
    // Satu segmen bisa berisi beberapa kalimat
    const parts = seg.text.match(/[^.!?]+[.!?]*/g) || [seg.text];
    for (const part of parts) {
      if (!buffer) start = seg.startSeconds;
      buffer += ` ${part}`;
      const words = buffer.trim().split(/\s+/).length;
      if (/[.!?]["')\]]?\s*$/.test(part) || words >= 35) flush();
    }
  }
  flush();
  return sentences;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : max)}…`;
}

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  sa.forEach((w) => sb.has(w) && inter++);
  return inter / (sa.size + sb.size - inter || 1);
}

/** Ambil kalimat terbaik yang tidak terlalu mirip satu sama lain. */
function pickDiverse(candidates: Sentence[], count: number): Sentence[] {
  const picked: Sentence[] = [];
  for (const s of [...candidates].sort((a, b) => b.score - a.score)) {
    if (picked.length >= count) break;
    if (picked.some((p) => jaccard(p.words, s.words) > 0.45)) continue;
    picked.push(s);
  }
  return picked;
}

const STYLE_SIZES: Record<string, { summary: number; takeaways: number }> = {
  standard: { summary: 5, takeaways: 6 },
  detailed: { summary: 9, takeaways: 10 },
  bullet_points: { summary: 3, takeaways: 10 },
  study_notes: { summary: 6, takeaways: 8 },
};

export function summarizeTranscript(
  segments: TranscriptSegment[],
  title: string,
  style = 'standard'
): SummaryData {
  const sentences = buildSentences(segments);
  if (sentences.length === 0) {
    throw new Error('Transkrip terlalu pendek untuk diringkas.');
  }
  const sizes = STYLE_SIZES[style] || STYLE_SIZES.standard;

  // --- Bobot kata: TF (seluruh transkrip) x IDF (antar kalimat)
  const tf = new Map<string, number>();
  const df = new Map<string, number>();
  for (const s of sentences) {
    s.words.forEach((w) => tf.set(w, (tf.get(w) || 0) + 1));
    new Set(s.words).forEach((w) => df.set(w, (df.get(w) || 0) + 1));
  }
  const n = sentences.length;
  const weight = new Map<string, number>();
  for (const [w, f] of tf) {
    if (f < 2 && n > 10) continue;
    weight.set(w, Math.log(1 + f) * Math.log(1 + n / (df.get(w) || 1)));
  }

  // --- Frasa dua kata yang sering muncul (mis. "kecerdasan buatan")
  const bigrams = new Map<string, number>();
  for (const s of sentences) {
    for (let i = 0; i < s.words.length - 1; i++) {
      const bg = `${s.words[i]} ${s.words[i + 1]}`;
      bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
    }
  }

  for (const s of sentences) {
    const unique = new Set(s.words);
    let sum = 0;
    unique.forEach((w) => (sum += weight.get(w) || 0));
    const lengthPenalty = Math.sqrt(Math.max(8, s.words.length));
    const isQuestion = /\?\s*$/.test(s.text);
    s.score = (sum / lengthPenalty) * (isQuestion ? 0.6 : 1);
  }

  const topBigrams = [...bigrams.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([bg]) => bg);
  const topWords = [...weight.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .filter((w) => !topBigrams.some((bg) => bg.split(' ').includes(w)));
  const keywords = [...topBigrams, ...topWords].slice(0, 12);

  // --- Ringkasan eksekutif: kalimat terbaik, disusun kronologis
  const summarySentences = pickDiverse(sentences, sizes.summary).sort((a, b) => a.index - b.index);
  const executiveSummary = summarySentences.map((s) => s.text).join(' ');

  // --- Poin penting
  const takeaways = pickDiverse(
    sentences.filter((s) => !/\?\s*$/.test(s.text)),
    sizes.takeaways
  ).sort((a, b) => a.index - b.index);
  const keyTakeaways = takeaways.map((s) => {
    const topic =
      [...new Set(s.words)].sort((a, b) => (weight.get(b) || 0) - (weight.get(a) || 0))[0] || 'Umum';
    const next = sentences[s.index + 1];
    return {
      point: truncate(s.text, 110),
      explanation: next && next.startSeconds - s.startSeconds < 60 ? `${s.text} ${next.text}` : s.text,
      category: capitalize(topic),
      timestamp: formatTime(s.startSeconds),
    };
  });

  // --- Bab: bagi transkrip ke rentang waktu yang sama panjang
  const totalDuration = segments[segments.length - 1]?.endSeconds || sentences[sentences.length - 1].startSeconds;
  // Satu bab kira-kira tiap 3 menit (maks. 12 bab)
  const chapterCount = Math.max(1, Math.min(12, Math.round(totalDuration / 180) || 1, Math.ceil(n / 4)));
  const chapterLength = totalDuration / chapterCount;
  const chapters: SummaryData['chapters'] = [];
  for (let c = 0; c < chapterCount; c++) {
    const from = c * chapterLength;
    const to = (c + 1) * chapterLength;
    const inChapter = sentences.filter(
      (s) => s.startSeconds >= from && (s.startSeconds < to || c === chapterCount - 1)
    );
    if (inChapter.length === 0) continue;

    // Kata khas bab ini: sering di bab ini, jarang di bab lain
    const local = new Map<string, number>();
    inChapter.forEach((s) => s.words.forEach((w) => local.set(w, (local.get(w) || 0) + 1)));
    const distinctive = [...local.entries()]
      .map(([w, f]) => [w, (f / inChapter.length) * Math.log(1 + n / (df.get(w) || 1))] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([w]) => capitalize(w));

    const best = [...inChapter].sort((a, b) => b.score - a.score)[0];
    chapters.push({
      timestamp: formatTime(inChapter[0].startSeconds),
      startSeconds: inChapter[0].startSeconds,
      title: distinctive.length ? distinctive.join(', ') : `Bagian ${c + 1}`,
      summary: truncate(best.text, 220),
    });
  }

  // --- Poin aksi: kalimat berisi ajakan / anjuran
  const actionItems = pickDiverse(
    sentences.filter((s) => isActionSentence(s.text)),
    style === 'detailed' ? 10 : 6
  )
    .sort((a, b) => a.index - b.index)
    .map((s) => `[${formatTime(s.startSeconds)}] ${truncate(s.text, 200)}`);

  // --- Tanya-jawab: pertanyaan yang diucapkan di video + kalimat sesudahnya
  const faq: SummaryData['faq'] = [];
  for (const s of sentences) {
    if (faq.length >= 6) break;
    const isQuestion = /\?\s*$/.test(s.text) || QUESTION_START.test(s.text);
    if (!isQuestion || s.words.length < 2) continue;
    const answer = sentences
      .slice(s.index + 1, s.index + 3)
      .filter((a) => !/\?\s*$/.test(a.text) && a.startSeconds - s.startSeconds < 90);
    if (answer.length === 0) continue;
    faq.push({
      question: `${s.text.replace(/[.!]+$/, '').replace(/\?*$/, '')}? (${formatTime(s.startSeconds)})`,
      answer: answer.map((a) => a.text).join(' '),
    });
  }

  // --- Sentimen & nada (berbasis leksikon)
  let pos = 0;
  let neg = 0;
  sentences.forEach((s) =>
    tokenize(s.text).forEach((w) => {
      if (POSITIVE.has(w)) pos++;
      if (NEGATIVE.has(w)) neg++;
    })
  );
  const polarity = (pos - neg) / (pos + neg || 1);
  const sentiment =
    pos + neg < 3 ? 'Netral' : polarity > 0.2 ? 'Positif' : polarity < -0.2 ? 'Negatif' : 'Netral / Seimbang';

  const questionRatio = sentences.filter((s) => /\?\s*$/.test(s.text)).length / n;
  const actionRatio = sentences.filter((s) => isActionSentence(s.text)).length / n;
  const casualRatio = sentences.filter((s) => CASUAL.test(s.text)).length / n;
  const tone = [
    casualRatio > 0.15 ? 'Santai / Percakapan' : 'Formal / Informatif',
    questionRatio > 0.15 ? 'Interaktif (banyak pertanyaan)' : null,
    actionRatio > 0.15 ? 'Instruktif' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    title: title || 'Ringkasan Video',
    executiveSummary,
    keyTakeaways,
    chapters,
    actionItems,
    faq,
    sentimentAndKeywords: {
      sentiment,
      tone,
      keywords,
      targetAudience: `Peminat topik: ${keywords.slice(0, 3).join(', ') || '-'}`,
    },
  };
}

/** Pencarian di transkrip (pengganti tanya-jawab LLM): peringkat segmen berdasarkan kecocokan kata (BM25). */
export function searchTranscript(segments: TranscriptSegment[], query: string, limit = 5) {
  const terms = [...new Set(tokenize(query))];
  const rawTerms = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const queryTerms = terms.length ? terms : rawTerms;
  if (queryTerms.length === 0) return [];

  // Gunakan jendela 3 segmen agar konteks jawaban tidak terpotong
  const windows = segments.map((seg, i) => {
    const group = segments.slice(i, i + 3);
    const text = group.map((g) => g.text).join(' ');
    return { seg, text, words: text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/) };
  });

  const N = windows.length;
  const avgLen = windows.reduce((s, w) => s + w.words.length, 0) / (N || 1);
  const dfq = new Map<string, number>();
  for (const term of queryTerms) {
    dfq.set(term, windows.filter((w) => w.words.some((x) => x.startsWith(term))).length);
  }

  const k1 = 1.2;
  const b = 0.75;
  const scored = windows
    .map((w) => {
      let score = 0;
      for (const term of queryTerms) {
        const f = w.words.filter((x) => x.startsWith(term)).length;
        if (!f) continue;
        const idf = Math.log(1 + (N - dfq.get(term)! + 0.5) / (dfq.get(term)! + 0.5));
        score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * w.words.length) / avgLen));
      }
      if (w.text.toLowerCase().includes(query.toLowerCase().trim())) score *= 1.5;
      return { ...w, score };
    })
    .filter((w) => w.score > 0)
    .sort((a, b2) => b2.score - a.score);

  const results: Array<{ startSeconds: number; timestamp: string; text: string; score: number }> = [];
  for (const w of scored) {
    if (results.length >= limit) break;
    // Hindari hasil yang tumpang tindih waktunya
    if (results.some((r) => Math.abs(r.startSeconds - w.seg.startSeconds) < 20)) continue;
    results.push({
      startSeconds: w.seg.startSeconds,
      timestamp: formatTime(w.seg.startSeconds),
      text: w.text,
      score: Math.round(w.score * 100) / 100,
    });
  }
  return results;
}
