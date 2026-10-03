/**
 * Ambil track audio dari file video langsung di browser (tanpa re-encode) agar yang diunggah
 * ke server hanya audionya — biasanya 10-50x lebih kecil dari videonya.
 * Bila format tidak didukung, kembalikan null dan file asli yang diunggah.
 */

// Codec yang bisa disalin apa adanya ke wadah M4A (MP4) atau WebM audio
const MP4_AUDIO_CODECS = new Set(['aac', 'mp3', 'flac', 'ac3', 'eac3', 'opus']);
const WEBM_AUDIO_CODECS = new Set(['opus', 'vorbis']);

export async function extractAudioTrack(
  file: File,
  onProgress?: (fraction: number) => void
): Promise<File | null> {
  // File audio tidak perlu diproses
  if (file.type.startsWith('audio/')) return null;

  try {
    // Dimuat saat dibutuhkan agar tidak menambah ukuran halaman awal
    const mb = await import('mediabunny');
    const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
    const track = await input.getPrimaryAudioTrack();
    if (!track?.codec) return null;

    const codec = track.codec as string;
    let format: InstanceType<typeof mb.Mp4OutputFormat> | InstanceType<typeof mb.WebMOutputFormat>;
    let ext: string;
    let mime: string;
    if (WEBM_AUDIO_CODECS.has(codec)) {
      format = new mb.WebMOutputFormat();
      ext = 'webm';
      mime = 'audio/webm';
    } else if (MP4_AUDIO_CODECS.has(codec)) {
      format = new mb.Mp4OutputFormat();
      ext = 'm4a';
      mime = 'audio/mp4';
    } else {
      return null;
    }

    const output = new mb.Output({ format, target: new mb.BufferTarget() });
    const conversion = await mb.Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: { discard: true },
    });
    if (!conversion.isValid) return null;

    conversion.onProgress = (p) => onProgress?.(p);
    await conversion.execute();

    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength < 1024) return null;
    // Tidak ada gunanya bila hasilnya hampir sebesar file asli
    if (buffer.byteLength > file.size * 0.8) return null;

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    return new File([buffer], `${baseName}.${ext}`, { type: mime });
  } catch (err) {
    console.warn('Ekstraksi audio di browser gagal, file asli akan diunggah:', err);
    return null;
  }
}
