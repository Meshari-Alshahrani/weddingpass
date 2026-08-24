/**
 * Cryptographic Token and Hashing Engine for WeddingPass
 * Implements opaque tokens and SHA-256 hashing to guarantee that raw tokens
 * are never stored plaintext in the database.
 * Cross-platform compatible (Node.js 18+, Vercel Edge, Modern Browsers).
 */

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateRandomString(length: number = 24): string {
  // Fail loudly instead of silently degrading to Math.random: invitation and
  // pass tokens are bearer credentials and MUST come from a CSPRNG.
  if (typeof globalThis === 'undefined' || !globalThis.crypto?.getRandomValues) {
    throw new Error('FATAL CRYPTO ERROR: Web Crypto getRandomValues is unavailable. Cannot generate secure tokens.');
  }
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);

  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE62_CHARS[bytes[i] % 62];
  }
  return result;
}

export function generateInvitationToken(): string {
  return `wp_inv_${generateRandomString(24)}`;
}

export function generateEntryPassToken(): string {
  return `wp_pass_${generateRandomString(28)}`;
}

/**
 * Calculates a standard SHA-256 hex string for a given raw token.
 * Compatible across modern browsers, Edge functions, and Node.js.
 */
export async function hashToken(token: string): Promise<string> {
  const normalized = token.trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);

  // Fail loudly instead of silently degrading: a fake "SHA-256" here would
  // forge pass hashes that collide trivially (ADR-002 invariant).
  if (typeof globalThis === 'undefined' || !globalThis.crypto?.subtle) {
    throw new Error('FATAL CRYPTO ERROR: Web Crypto subtle.digest is unavailable. Cannot hash tokens securely.');
  }

  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time comparison to prevent side-channel timing attacks on hashes/tokens
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
