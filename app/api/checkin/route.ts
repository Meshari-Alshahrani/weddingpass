import { NextRequest, NextResponse } from 'next/server';
import { executeCheckIn, searchParties, getDefaultEvent } from '@/lib/db/store';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { getVerifiedGateSession } from '@/lib/security/gateAuth';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = checkRateLimit(`checkin_${ip}`, 120, 60000); // 120 requests/minute per IP
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, code: 'RATE_LIMIT_EXCEEDED', message: 'تم تجاوز الحد المسموح للطلبات. يرجى الانتظار قليلاً.' },
        { status: 429 }
      );
    }

    // 1. MANDATORY GATE AUTHENTICATION ENFORCEMENT
    const session = await getVerifiedGateSession(req);
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          code: 'UNAUTHORIZED',
          message: 'جلسة البوابة غير مصرحة أو منتهية. يرجى تسجيل الدخول برمز PIN أولاً.',
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { token, passToken, checkinType, overrideCount, forceCrossSection } = body;

    const rawToken = token || passToken;
    if (!rawToken || typeof rawToken !== 'string') {
      return NextResponse.json(
        { success: false, code: 'INVALID_REQUEST', message: 'يرجى تقديم رمز بطاقة الدخول' },
        { status: 400 }
      );
    }

    // 2. Derive Operator & Station STRICTLY from Verified Server Session
    const station = session.stationName;
    const operator = session.operatorName;
    const section = session.gateSection;

    // 3. Supervisor-Only Cross-Section Override Governance
    const isOverrideRequested = Boolean(forceCrossSection);
    if (isOverrideRequested && session.role !== 'supervisor') {
      return NextResponse.json(
        {
          success: false,
          code: 'SUPERVISOR_REQUIRED',
          message: 'تجاوز تحذير القسم يتطلب موافقة واعتماد المشرف العام للبوابات.',
        },
        { status: 403 }
      );
    }

    const type = checkinType === 'MANUAL_SEARCH' ? 'MANUAL_SEARCH' : 'QR_SCAN';

    // 4. Atomic Execution
    const result = await executeCheckIn(
      session.eventId,
      rawToken,
      station,
      operator,
      type,
      overrideCount,
      section,
      isOverrideRequested
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error.message || 'حدث خطأ غير متوقع أثناء الفحص' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Gate session required for manual search lookups
    const session = await getVerifiedGateSession(req);
    if (!session) {
      return NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: 'جلسة البوابة غير مصرحة' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ success: true, parties: [] });
    }

    const results = await searchParties(session.eventId, query.trim());
    return NextResponse.json({ success: true, parties: results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
