/**
 * Client-side hashing utilities for OFFLINE pass verification.
 *
 * The server stores only SHA-256 hashes of pass tokens (ADR-002). When a gate
 * device is offline it must therefore hash the scanned token locally and
 * compare it against the sanitized cache delivered by /api/gate/cache.
 *
 * These helpers are browser-first (Web Crypto) but also work under Node >= 18,
 * which keeps them unit-testable without a DOM environment.
 */

export async function sha256Hex(input: string): Promise<string> {
  if (typeof globalThis === 'undefined' || !globalThis.crypto?.subtle) {
    throw new Error('Web Crypto SubtleCrypto is unavailable. Offline verification requires a modern browser.');
  }
  const data = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-work comparison for two equal-length strings (e.g. lowercase hex).
 *
 * HONESTY NOTE: browsers expose no hard constant-time guarantee (JIT/GC make
 * true timing safety impossible), so this is a fixed-work best-effort compare,
 * NOT equivalent to Node's crypto.timingSafeEqual. Timing attacks are also not
 * a meaningful threat model for local offline verification on a trusted gate
 * device — this helper exists to keep the comparison branch-uniform.
 */
export function fixedTimeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
