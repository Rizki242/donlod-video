import dns from 'dns/promises';
import net from 'net';

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  const lower = ip.toLowerCase();
  if (lower.startsWith('::ffff:')) return isPrivateIP(lower.slice(7));
  return (
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe80') ||
    lower.startsWith('ff')
  );
}

// Situs yang hanya bisa diakses lewat VPN kantor/kampus sering berada di IP privat.
// Aktifkan ALLOW_PRIVATE_URLS=true bila server ini dipakai pribadi/di jaringan tepercaya.
const ALLOW_PRIVATE = process.env.ALLOW_PRIVATE_URLS === 'true';

/**
 * Validasi URL input pengguna: hanya http/https dan (default) tidak mengarah ke jaringan internal
 * (mencegah SSRF lewat yt-dlp). Bila memakai proxy, DNS di-resolve oleh proxy/VPN sehingga
 * domain yang tidak dikenal DNS lokal tetap diizinkan.
 */
export async function assertPublicUrl(raw: string, opts: { viaProxy?: boolean } = {}): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error('Format URL tidak valid.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Hanya URL http/https yang didukung.');
  }

  if (ALLOW_PRIVATE) return parsed;

  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new Error('URL ke jaringan lokal tidak diizinkan.');
  }

  const addresses = net.isIP(host)
    ? [host]
    : (await dns.lookup(host, { all: true }).catch(() => [])).map((a) => a.address);

  if (addresses.length === 0) {
    if (opts.viaProxy) return parsed;
    throw new Error(
      `Domain "${host}" tidak dapat ditemukan. Jika situs hanya bisa dibuka lewat VPN, aktifkan VPN di server atau isi proxy VPN.`
    );
  }
  if (addresses.some(isPrivateIP)) {
    throw new Error('URL ke jaringan lokal tidak diizinkan.');
  }
  return parsed;
}
