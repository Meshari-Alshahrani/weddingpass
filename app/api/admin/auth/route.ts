import { NextRequest, NextResponse } from 'next/server';
import { getDefaultEvent } from '@/lib/db/store';
import { constantTimeCompare } from '@/lib/crypto/tokens';
import { checkDistributedRateLimit } from '@/lib/security/rateLimiter';
import {
  ADMIN_SESSION_MAX_AGE_SECONDS,
  ADMIN_SESSION_TTL_MS,
  createAdminSessionToken,
  getAdminSessionCookieName,
} from '@/lib/security/adminSession';

export const dynamic = 'force-dynamic';

/**
 * Resolves the admin dashboard PIN. It is intentionally independent from the
 * gate PIN and the supervisor PIN (separate trust boundaries). Production
 * fails closed when it is missing.
 */
function resolveAdminPin(): string {
  const pin = process.env.ADMIN_PIN;
  if (!pin) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY ERROR: ADMIN_PIN environment variable is missing in production!');
    }
    return 'dev_admin_pin_local';
  }
  return pin;
}

/**
 * Defense-in-depth: the dashboard credential must never collide with the
 * gate/supervisor credentials. A shared secret would let any gate operator
 * reach organizer data. Enforced in production at login time.
 */
function assertAdminPinSeparation(adminPin: string, eventGatePin: string | null): void {
  if (process.env.NODE_ENV !== 'production') return;

  const supervisorPin = process.env.SUPERVISOR_PIN;
  const conflicts: string[] = [];

  if (eventGatePin && constantTimeCompare(adminPin.trim(), String(eventGatePin).trim())) {
    conflicts.push('event.gate_pin');
  }
  if (supervisorPin && constantTimeCompare(adminPin.trim(), supervisorPin.trim())) {
    conflicts.push('SUPERVISOR_PIN');
  }

  if (conflicts.length > 0) {
    throw new Error(
      `FATAL SECURITY ERROR: ADMIN_PIN must not equal ${conflicts.join(' or ')}. Regenerate a unique random admin PIN.`
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = await checkDistributedRateLimit(`admin_auth_${ip}`, 10, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, code: 'RATE_LIMIT_EXCEEDED', message: 'تم تجاوز عدد محاولات الدخول. يرجى الانتظار دقيقة.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const pin = body?.pin;
    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { success: false, code: 'INVALID_REQUEST', message: 'يرجى إدخال رمز المرور الإداري' },
        { status: 400 }
      );
    }

    const resolvedAdminPin = resolveAdminPin();
    const event = await getDefaultEvent();
    assertAdminPinSeparation(resolvedAdminPin, event.gate_pin ?? null);

    if (!constantTimeCompare(pin.trim(), resolvedAdminPin.trim())) {
      return NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: 'رمز المرور غير صحيح' },
        { status: 401 }
      );
    }

    // The session is bound to the event it was issued for; API mutations must
    // verify this eventId against the data they touch (never trust client ids).
    const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
    const sessionToken = createAdminSessionToken({
      adminId: 'organizer',
      role: 'owner',
      eventId: event.id,
      expiresAt,
    });

    const response = NextResponse.json({
      success: true,
      code: 'AUTHENTICATED',
      message: 'تم توثيق جلسة لوحة الإدارة 🛡️',
    });

    const isProd = process.env.NODE_ENV === 'production';
    // The token never appears in the JSON body — HttpOnly cookie only.
    response.cookies.set(getAdminSessionCookieName(), sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: '/',
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: err.message || 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, code: 'LOGGED_OUT' });
  response.cookies.set(getAdminSessionCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}
