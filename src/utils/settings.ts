/**
 * Pengaturan per-pengguna (disimpan di browser): bahasa ucapan & proxy VPN.
 */
export interface AppSettings {
  /** "auto" atau kode ISO bahasa ucapan (mis. "id", "en") */
  language: string;
  /** Proxy untuk mengakses situs yang butuh VPN, mis. "socks5://127.0.0.1:1080". Kosong = default server. */
  proxy: string;
}

const STORAGE_KEY = 'videoscribe-settings';
const DEFAULTS: AppSettings = { language: 'auto', proxy: '' };

let current: AppSettings = (() => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
})();

export function getSettings(): AppSettings {
  return current;
}

export function saveSettings(next: Partial<AppSettings>): AppSettings {
  current = { ...current, ...next };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // mode privat / storage diblokir: tetap dipakai selama sesi
  }
  return current;
}

export const LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Deteksi otomatis' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'en', label: 'English' },
  { value: 'ms', label: 'Bahasa Melayu' },
  { value: 'jw', label: 'Bahasa Jawa' },
  { value: 'su', label: 'Bahasa Sunda' },
  { value: 'ar', label: 'Arab' },
  { value: 'ja', label: 'Jepang' },
  { value: 'ko', label: 'Korea' },
  { value: 'zh', label: 'Mandarin' },
];
