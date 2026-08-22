/**
 * Cryptographic Token and Hashing Engine for WeddingPass
 * Implements opaque tokens and SHA-256 hashing to guarantee that raw tokens
 * are never stored plaintext in the database.
 */

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateRandomString(length: number = 24): string {
  const bytes = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    // Node.js or Server environment
    const cryptoModule = require('crypto');
    const randomBytes = cryptoModule.randomBytes(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = randomBytes[i];
    }
  }

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

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Fallback Node.js crypto
    const cryptoModule = require('crypto');
    return cryptoModule.createHash('sha256').update(normalized).digest('hex');
  }
}
