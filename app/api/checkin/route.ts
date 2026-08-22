import { NextRequest, NextResponse } from 'next/server';
import { executeCheckIn, searchParties } from '@/lib/db/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventId, passToken, stationName, operatorName, checkinType, overrideCount } = body;

    if (!eventId || !passToken) {
      return NextResponse.json(
        { success: false, code: 'INVALID_REQUEST', message: 'يرجى تقديم معرف الحفل ورمز بطاقة الدخول' },
        { status: 400 }
      );
    }

    const station = stationName || 'البوابة الرئيسية';
    const operator = operatorName || 'مشغل البوابة';
    const type = checkinType === 'MANUAL_SEARCH' ? 'MANUAL_SEARCH' : 'QR_SCAN';

    const result = await executeCheckIn(eventId, passToken, station, operator, type, overrideCount);

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
    const eventId = searchParams.get('eventId');
    const query = searchParams.get('query');

    if (!eventId || !query) {
      return NextResponse.json({ success: false, parties: [] });
    }

    const results = await searchParties(eventId, query);
    return NextResponse.json({ success: true, parties: results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
