import { NextRequest, NextResponse } from 'next/server';
import { executeCheckIn, searchParties, getDefaultEvent } from '@/lib/db/store';
import { checkRateLimit } from '@/lib/security/rateLimiter';

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

    const body = await req.json();
    const { token, passToken, gateSessionToken, stationName, operatorName, checkinType, overrideCount, gateSection, forceCrossSection } = body;

    const rawToken = token || passToken;
    if (!rawToken) {
      return NextResponse.json(
        { success: false, code: 'INVALID_REQUEST', message: 'يرجى تقديم رمز بطاقة الدخول' },
        { status: 400 }
      );
    }

    const event = await getDefaultEvent();
    let station = stationName || 'بوابة الاستقبال 1';
    let operator = operatorName || 'مشغل البوابة';
    let section = gateSection || 'men';

    // Verify Server-Side Gate Session if present
    if (gateSessionToken) {
      const { verifyGateSessionToken } = await import('@/lib/security/gateAuth');
      const verified = await verifyGateSessionToken(gateSessionToken);
      if (verified) {
        station = verified.stationName;
        operator = verified.operatorName;
        section = verified.gateSection;
      }
    }

    const type = checkinType === 'MANUAL_SEARCH' ? 'MANUAL_SEARCH' : 'QR_SCAN';

    const result = await executeCheckIn(
      event.id,
      rawToken,
      station,
      operator,
      type,
      overrideCount,
      section,
      Boolean(forceCrossSection)
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
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');

    const event = await getDefaultEvent();
    if (!query) {
      return NextResponse.json({ success: false, parties: [] });
    }

    const results = await searchParties(event.id, query);
    return NextResponse.json({ success: true, parties: results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
