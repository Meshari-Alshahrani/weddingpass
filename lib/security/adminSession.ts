import crypto from 'node:crypto';
import { constantTimeCompare } from '../crypto/tokens.ts';

/**
 * Pure Admin Session Token primitives (HMAC-SHA256).
 *
 * This module is intentionally dependency-free (no database imports) so it can
 * be safely imported by proxy.ts, route handlers, and Server Components alike.
 * Authorization decisions live in lib/security/adminDal.ts and each API route;
 * this file only signs and verifies opaque session tokens.
 */

export type AdminRole = 'owner' | 'organizer' | 'superadmin';

export interface AdminSessionPayload {
  adminId: string;
  role: AdminRole;
  eventId?: string;
  expiresAt: number;
}

export const ADMIN_SESSION_TTL_MS = 4 * 60 * 60 * 1000;
export const ADMIN_SESSION_MAX_AGE_SECONDS = 4 * 60 * 60;

export function getAdminSecret(): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY ERROR: ADMIN_SECRET environment variable is missing in production!');
    }
    return 'dev_admin_hmac_secret_weddingpass_2026_hardened';
  }
  return secret;
}

/**
 * OWASP __Host- prefix in production requires: Secure, Path=/, no Domain.
 */
export function getAdminSessionCookieName(): string {
  return process.env.NODE_ENV === 'production' ? '__Host-admin_session' : 'admin_session';
}

/**
 * Creates a signed HMAC-SHA256 Admin Session Token (`base64url(payload).base64url(hmac)`).
 */
export function createAdminSessionToken(payload: AdminSessionPayload): string {
  const secret = getAdminSecret();
  const data = JSON.stringify(payload);
  const base64Data = Buffer.from(data, 'utf-8').toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(base64Data).digest('base64url');
  return `${base64Data}.${hmac}`;
}

/**
 * Verifies an Admin Session Token with constant-time signature comparison.
 * Returns null for any tampered, malformed, or expired token.
 */
export function verifyAdminSessionToken(token: string | undefined | null): AdminSessionPayload | null {
  try {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;

    const secret = getAdminSecret();
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [base64Data, providedHmac] = parts;
    const expectedHmac = crypto.createHmac('sha256', secret).update(base64Data).digest('base64url');

    if (!constantTimeCompare(providedHmac, expectedHmac)) {
      return null;
    }

    const jsonStr = Buffer.from(base64Data, 'base64url').toString('utf-8');
    const payload: AdminSessionPayload = JSON.parse(jsonStr);

    if (!payload.adminId || !payload.role || typeof payload.expiresAt !== 'number') return null;
    if (Date.now() > payload.expiresAt) return null; // Expired

    return payload;
  } catch {
    return null;
  }
}
