import { TranscriptSegment, VideoSummary, VideoMetadata } from '../types';

export interface SampleVideoItem {
  id: string;
  metadata: VideoMetadata;
  segments: TranscriptSegment[];
  summary: VideoSummary;
}

export const SAMPLE_VIDEOS: SampleVideoItem[] = [
  {
    id: 'ai-mastery-2026',
    metadata: {
      type: 'youtube',
      videoId: 'sample-ai-1',
      title: 'Evolusi AI & Kecerdasan Buatan di Industri 2026: Peluang & Tantangan',
      author: 'Tech Innovators Indonesia',
      thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
      duration: '42:15',
      durationSeconds: 2535,
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      captionsAvailable: true,
    },
    summary: {
      title: 'Evolusi AI & Kecerdasan Buatan di Industri 2026',
      executiveSummary:
        'Sesi ini membahas pergeseran paradigma kecerdasan buatan dari sekadar model bahasa generatif menuju sistem agentic multimodal otonom. Pembicara menguraikan bagaimana bisnis di Indonesia dan global memanfaatkan model multimodal untuk mengotomasi alur kerja video, coding, dan analisis data, sembari menyoroti pentingnya tata kelola etika data dan efisiensi komputasi.',
      keyTakeaways: [
        {
          point: 'Transformasi Menuju AI Agentik Multimodal',
          explanation:
            'Sistem AI modern tidak lagi hanya menjawab teks pasif, melainkan mampu mengorkestrasi tindakan di berbagai alat, memproses suara, video, dan kode secara bersamaan.',
          category: 'Teknologi Inti',
          timestamp: '03:15',
        },
        {
          point: 'Efisiensi Biaya Komputasi & On-Device Processing',
          explanation:
            'Penggunaan arsitektur hybrid (cloud + on-device inference) memangkas latensi hingga 60% dan mengurangi biaya infrastruktur cloud secara signifikan.',
          category: 'Infrastruktur',
          timestamp: '14:40',
        },
        {
          point: 'Privasi Data & Regulasi AI Global',
          explanation:
            'Kepatuhan terhadap standar keamanan data lokal dan internasional kini menjadi prasyarat utama sebelum penerapan enterprise AI.',
          category: 'Regulasi & Etika',
          timestamp: '27:10',
        },
        {
          point: 'Kebutuhan Reskilling Tenaga Kerja Kreatif & Teknis',
          explanation:
            'Profesi masa depan berfokus pada kolaborasi manusia dengan AI, di mana kemampuan problem formulation dan evaluasi output AI lebih bernilai dibanding eksekusi manual rutin.',
          category: 'SDM & Karir',
          timestamp: '35:20',
        },
      ],
      chapters: [
        {
          timestamp: '00:00',
          startSeconds: 0,
          title: 'Pembukaan & Lanskap AI Terkini',
          summary: 'Pengantar evolusi teknologi komputasi dan latar belakang adopsi AI di berbagai sektor industri.',
        },
        {
          timestamp: '08:30',
          startSeconds: 510,
          title: 'Kemampuan Multimodal & Pemrosesan Video',
          summary: 'Demonstrasi bagaimana AI membaca audio percakapan video panjang hingga 180 menit tanpa kehilangan konteks.',
        },
        {
          timestamp: '21:15',
          startSeconds: 1275,
          title: 'Studi Kasus Implementasi Nyata di Perusahaan',
          summary: 'Paparan angka riil peningkatan produktivitas tim hingga 3.5x dalam dokumentasi dan riset materi.',
        },
        {
          timestamp: '34:00',
          startSeconds: 2040,
          title: 'Tanya Jawab & Panduan Masa Depan',
          summary: 'Jawaban atas kekhawatiran automasi kerja dan langkah strategis mempersiapkan ekosistem digital.',
        },
      ],
      actionItems: [
        'Lakukan audit alur kerja manual yang menghabiskan waktu (seperti merangkum video rapat atau materi kuliah).',
        'Terapkan alat transkripsi berbasis AI dengan timestamp presisi untuk memudahkan pencarian arsip video.',
        'Susun pedoman internal perusahaan terkait keamanan data rahasia saat berinteraksi dengan AI.',
        'Mulai uji coba sistem multimodal untuk konversi otomatis materi video ke dokumentasi SOP atau modul belajar.',
      ],
      faq: [
        {
          question: 'Berapa durasi video maksimal yang dapat diproses secara efektif?',
          answer:
            'Model modern seperti Gemini 3 series mampu memproses audio dan video hingga 180 menit (3 jam) dengan pemetaan kronologis yang sangat akurat.',
        },
        {
          question: 'Bagaimana akurasi transkripsi untuk percakapan berbahasa Indonesia?',
          answer:
            'Akurasi sangat tinggi mencapai 98% karena model dilatih dengan fonetik multi-bahasa termasuk dialek, istilah serapan, dan aksen lokal.',
        },
      ],
      sentimentAndKeywords: {
        sentiment: 'Optimis & Mendorong Inovasi',
        tone: 'Profesional, Edukatif, Visioner',
        keywords: ['Kecerdasan Buatan', 'Multimodal', 'Transkrip Video', 'Efisiensi Kerja', 'AI Agents', 'Automation'],
        targetAudience: 'Praktisi Teknologi, Mahasiswa, Konten Kreator, dan Eksekutif Bisnis',
      },
    },
    segments: [
      {
        id: 1,
        start: '00:00',
        end: '00:18',
        startSeconds: 0,
        endSeconds: 18,
        speaker: 'Moderator',
        text: 'Halo semuanya, selamat datang di sesi seminar tahunan Tech Innovators. Hari ini kita akan mengupas tuntas masa depan pemrosesan konten dan kecerdasan buatan.',
      },
      {
        id: 2,
        start: '00:19',
        end: '00:45',
        startSeconds: 19,
        endSeconds: 45,
        speaker: 'Dr. Pratama (Narasumber)',
        text: 'Terima kasih rekan-rekan. Banyak yang bertanya, apa langkah besar berikutnya setelah chatbot teks? Jawabannya adalah pemahaman suara dan video multimodal secara instan.',
      },
      {
        id: 3,
        start: '00:46',
        end: '01:20',
        startSeconds: 46,
        endSeconds: 80,
        speaker: 'Dr. Pratama (Narasumber)',
        text: 'Bayangkan video webinar atau rekaman kuliah berdurasi hingga 180 menit. Kita tidak lagi harus menonton manual selama tiga jam hanya untuk mencari satu rumus atau kesimpulan penting.',
      },
      {
        id: 4,
        start: '01:21',
        end: '01:58',
        startSeconds: 81,
        endSeconds: 118,
        speaker: 'Dr. Pratama (Narasumber)',
        text: 'Melalui ekstraksi gelombang audio dan model pengenalan fonetik canggih, AI dapat mengubah setiap kata ucapan menjadi transkrip terstruktur dengan stempel waktu detik ke detik.',
      },
      {
        id: 5,
        start: '01:59',
        end: '02:35',
        startSeconds: 119,
        endSeconds: 155,
        speaker: 'Moderator',
        text: 'Betul sekali, dan yang paling menarik adalah kemampuannya merangkum menjadi poin-poin eksekutif serta mengekspornya langsung ke format PDF dan subtitle SRT.',
      },
      {
        id: 6,
        start: '02:36',
        end: '03:15',
        startSeconds: 156,
        endSeconds: 195,
        speaker: 'Dr. Pratama (Narasumber)',
        text: 'Tepat! Subtitle SRT itu langsung siap pakai untuk YouTube creator atau tim penerjemah internasional, menghemat ratusan jam kerja produksi.',
      },
    ],
  },
  {
    id: 'startup-growth-masterclass',
    metadata: {
      type: 'web_video',
      title: 'Masterclass: Strategi Product-Market Fit & Monetisasi Konten Digital',
      author: 'Founders Academy',
      thumbnailUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80',
      duration: '58:20',
      durationSeconds: 3500,
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      captionsAvailable: true,
    },
    summary: {
      title: 'Strategi Product-Market Fit & Monetisasi Konten Digital',
      executiveSummary:
        'Workshop intensif ini memberikan panduan taktis bagi startup dan kreator konten dalam menemukan Product-Market Fit (PMF) serta memaksimalkan retensi pelanggan. Narasumber membagikan matriks retensi, strategi pricing berbasis nilai, dan cara membangun loyalitas komunitas organik.',
      keyTakeaways: [
        {
          point: 'Validasi Masalah Sebelum Membangun Solusi',
          explanation:
            'Kesalahan terbesar founder pemula adalah jatuh cinta pada produk bukan pada masalah konsumen. Lakukan minimal 30 wawancara mendalam sebelum coding.',
          category: 'Product Strategy',
          timestamp: '05:12',
        },
        {
          point: 'Metrik North Star yang Sebenarnya',
          explanation:
            'Fokus pada frekuensi penggunaan berulang (repeat usage) mingguan daripada sekadar angka download awal yang membengkak akibat iklan.',
          category: 'Analytics',
          timestamp: '18:40',
        },
        {
          point: 'Efek Jaringan Melalui Ekosistem Terbuka',
          explanation:
            'Memberikan API atau opsi ekspor data (PDF, JSON, SRT) membuat pengguna merasa aman dan memperkuat integrasi ke sistem kerja harian mereka.',
          category: 'Growth & Distribution',
          timestamp: '32:15',
        },
      ],
      chapters: [
        {
          timestamp: '00:00',
          startSeconds: 0,
          title: 'Pengantar Fundamental Bisnis Digital',
          summary: 'Menentukan ceruk pasar dan proposisi nilai unik.',
        },
        {
          timestamp: '12:30',
          startSeconds: 750,
          title: 'Eksperimen Cepat & Siklus Feedback',
          summary: 'Cara iterasi mingguan tanpa membuang anggaran riset berlebihan.',
        },
        {
          timestamp: '29:45',
          startSeconds: 1785,
          title: 'Arsitektur Monetisasi Berkelanjutan',
          summary: 'Perbandingan model freemium, langganan, dan lisensi sekali bayar.',
        },
      ],
      actionItems: [
        'Buat formulir survei sederhana untuk 20 pengguna pertama Anda.',
        'Tetapkan 1 metrik retensi kunci untuk dievaluasi setiap Senin pagi.',
        'Sederhanakan alur onboarding agar pengguna mendapatkan nilai instan dalam 30 detik pertama.',
      ],
      faq: [
        {
          question: 'Kapan saat yang tepat untuk mulai monetisasi?',
          answer:
            'Ketika setidaknya 40% pengguna aktif menyatakan mereka akan sangat kecewa jika layanan Anda ditutup esok hari.',
        },
      ],
      sentimentAndKeywords: {
        sentiment: 'Pragmatis, Taktis, dan Penuh Motivasi',
        tone: 'Lugas dan Berbasis Data',
        keywords: ['Product Market Fit', 'Retention', 'Pricing', 'Customer Discovery', 'Lean Startup'],
        targetAudience: 'Startup Founders, Product Managers, Solopreneurs',
      },
    },
    segments: [
      {
        id: 1,
        start: '00:00',
        end: '00:25',
        startSeconds: 0,
        endSeconds: 25,
        speaker: 'Coach Nadia',
        text: 'Selamat pagi rekan-rekan pembelajar. Hari ini kita tidak akan membahas teori rumit, melainkan fakta lapangan kenapa 9 dari 10 produk digital gagal bertahan di tahun pertama.',
      },
      {
        id: 2,
        start: '00:26',
        end: '00:58',
        startSeconds: 26,
        endSeconds: 58,
        speaker: 'Coach Nadia',
        text: 'Penyebab utamanya sederhana: mereka membuat produk yang tidak ada yang membutuhkannya secara mendesak. Hari ini kita belajar membalik logika itu.',
      },
      {
        id: 3,
        start: '00:59',
        end: '01:34',
        startSeconds: 59,
        endSeconds: 94,
        speaker: 'Coach Nadia',
        text: 'Lihatlah bagaimana aplikasi modern mempermudah hidup. Misalnya mengubah video atau audio panjang menjadi ringkasan yang langsung bisa dibaca tim dalam 2 menit.',
      },
    ],
  },
];
