import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  AdminSessionPayload,
  getAdminSessionCookieName,
  verifyAdminSessionToken,
} from './adminAuth';

/**
 * Data Access Layer guard for every admin Server Component and API surface.
 *
 * This is the REAL authorization boundary (Next.js guidance: Proxy is only an
 * optimistic early check). Every admin page calls requireAdminSession() BEFORE
 * any sensitive query runs, so guest data never reaches a response payload
 * without a verified session — not even inside an RSC payload hidden behind a
 * client-side lock screen.
 */
export async function getOptionalAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminSessionCookieName())?.value;
  if (!token) return null;
  return verifyAdminSessionToken(token);
}

/**
 * Verifies the admin session or redirects to the login screen.
 * The bound eventId is mandatory: sessions are always scoped to one event.
 */
export async function requireAdminSession(): Promise<AdminSessionPayload> {
  const session = await getOptionalAdminSession();
  if (!session || !session.eventId) {
    redirect('/admin/login');
  }
  return session;
}
