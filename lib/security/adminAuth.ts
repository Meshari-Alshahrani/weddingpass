import type { NextRequest } from 'next/server';
import { constantTimeCompare } from '../crypto/tokens.ts';
import { isSupabaseConfigured, supabaseAdmin } from '../db/supabase.ts';
import {
  createAdminSessionToken,
  getAdminSecret,
  getAdminSessionCookieName,
  verifyAdminSessionToken,
} from './adminSession.ts';
import type { AdminRole, AdminSessionPayload } from './adminSession.ts';

// Pure token primitives live in ./adminSession.ts so proxy.ts and Server
// Components can import them without pulling the database client. They are
// re-exported here for backward compatibility with existing call sites/tests.
export { createAdminSessionToken, verifyAdminSessionToken, getAdminSecret, getAdminSessionCookieName };
export type { AdminSessionPayload, AdminRole };

/**
 * Verifies Admin Authorization from NextRequest across the HttpOnly session
 * cookie, Bearer tokens, Supabase Auth JWTs, or a strict master key.
 *
 * There is NO automatic development bypass: local development either opts in
 * explicitly via WEDDINGPASS_ALLOW_MOCK=true or authenticates through
 * /api/admin/auth like production does.
 */
export async function getVerifiedAdminSession(req: NextRequest, targetEventOwnerId?: string): Promise<AdminSessionPayload | null> {
  // 1. Check Admin HttpOnly Cookie (issued by /api/admin/auth)
  const cookieToken = req.cookies.get('admin_session')?.value || req.cookies.get('__Host-admin_session')?.value;
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
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (!error && data?.user) {
          const user = data.user;
          const userRole = user.app_metadata?.role || user.user_metadata?.role;
          const isOwner = targetEventOwnerId ? user.id === targetEventOwnerId : false;
          const isAdmin = userRole === 'admin' || userRole === 'owner' || userRole === 'superadmin' || isOwner;

          if (isAdmin) {
            return {
              adminId: user.id,
              role: (userRole as AdminRole) || (isOwner ? 'owner' : 'organizer'),
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

  // Explicit local-development opt-in only — never implicit, never in tests.
  if (process.env.NODE_ENV !== 'production' && process.env.WEDDINGPASS_ALLOW_MOCK === 'true') {
    return {
      adminId: 'dev_admin',
      role: 'owner',
      expiresAt: Date.now() + 86400000,
    };
  }

  return null;
}
