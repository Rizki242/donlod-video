import type { NextFunction, Request, Response } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

/** Pembatas laju sederhana per IP (in-memory, cukup untuk satu instance). */
export function rateLimit(opts: { windowMs: number; max: number; message?: string }) {
  const buckets = new Map<string, Bucket>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  }, opts.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > opts.max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      res.status(429).json({ error: opts.message || 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' });
      return;
    }
    next();
  };
}

/** Header keamanan dasar untuk semua respons. */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
}
