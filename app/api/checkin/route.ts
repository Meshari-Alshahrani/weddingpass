import { NextRequest, NextResponse } from 'next/server';
import { executeCheckIn, searchParties, getDefaultEvent } from '@/lib/db/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, passToken, stationName, operatorName, checkinType, overrideCount, gateSection, forceCrossSection } = body;

    const rawToken = token || passToken;
    if (!rawToken) {
      return NextResponse.json(
        { success: false, code: 'INVALID_REQUEST', message: 'يرجى تقديم رمز بطاقة الدخول' },
        { status: 400 }
      );
    }

    const event = await getDefaultEvent();
    const station = stationName || 'بوابة الاستقبال 1';
    const operator = operatorName || 'مشغل البوابة';
    const type = checkinType === 'MANUAL_SEARCH' ? 'MANUAL_SEARCH' : 'QR_SCAN';

    const result = await executeCheckIn(
      event.id,
      rawToken,
      station,
      operator,
      type,
      overrideCount,
      gateSection || 'men',
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
