import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { constantTimeCompare } from '../crypto/tokens.ts';
import { isSupabaseConfigured, supabase } from '../db/supabase.ts';

export interface AdminSessionPayload {
  adminId: string;
  role: 'owner' | 'organizer' | 'superadmin';
  eventId?: string;
  expiresAt: number;
}

function getAdminSecret(): string {
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
 * Creates a signed HMAC Admin Session Token
 */
export function createAdminSessionToken(payload: AdminSessionPayload): string {
  const secret = getAdminSecret();
  const data = JSON.stringify(payload);
  const base64Data = Buffer.from(data, 'utf-8').toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(base64Data).digest('base64url');
  return `${base64Data}.${hmac}`;
}

/**
 * Verifies an Admin Session Token
 */
export function verifyAdminSessionToken(token: string): AdminSessionPayload | null {
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

    if (Date.now() > payload.expiresAt) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Verifies Admin Authorization from NextRequest across Supabase Auth, Cookie, or Headers
 */
export async function getVerifiedAdminSession(req: NextRequest, targetEventOwnerId?: string): Promise<AdminSessionPayload | null> {
  // 1. Check Admin HttpOnly Cookie
  const cookieToken = req.cookies.get('admin_session')?.value;
  if (cookieToken) {
    const verified = verifyAdminSessionToken(cookieToken);
    if (verified) return verified;
  }

  // 2. Check Authorization Bearer Header
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();

    // Check custom HMAC admin token first
    const customVerified = verifyAdminSessionToken(token);
    if (customVerified) return customVerified;

    // Check Supabase Auth JWT if configured
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user) {
          const user = data.user;
          const userRole = user.app_metadata?.role || user.user_metadata?.role;
          const isOwner = targetEventOwnerId ? user.id === targetEventOwnerId : false;
          const isAdmin = userRole === 'admin' || userRole === 'owner' || userRole === 'superadmin' || isOwner;

          if (isAdmin) {
            return {
              adminId: user.id,
              role: (userRole as any) || (isOwner ? 'owner' : 'organizer'),
              expiresAt: Date.now() + 3600000,
            };
          }
        }
      } catch {
        // Return null
      }
    }
  }

  // 3. Direct API Master Key (Dev/CI only or strict ADMIN_SECRET)
  const directKey = req.headers.get('x-admin-key');
  if (directKey) {
    const adminSecret = getAdminSecret();
    if (constantTimeCompare(directKey.trim(), adminSecret.trim())) {
      return {
        adminId: 'master_admin',
        role: 'superadmin',
        expiresAt: Date.now() + 3600000,
      };
    }
  }

  // In non-production local development mode, allow admin dashboard access if no strict flag
  if (process.env.NODE_ENV !== 'production' && !process.env.STRICT_ADMIN_AUTH) {
    return {
      adminId: 'dev_admin',
      role: 'owner',
      expiresAt: Date.now() + 86400000,
    };
  }

  return null;
}
