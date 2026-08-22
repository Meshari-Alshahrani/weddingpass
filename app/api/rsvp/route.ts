import { NextRequest, NextResponse } from 'next/server';
import { submitPartyRSVP, getPartyByInvitationToken } from '@/lib/db/store';
import { checkRateLimit } from '@/lib/security/rateLimiter';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = checkRateLimit(`rsvp_${ip}`, 30, 60000); // 30 RSVPs per minute per IP
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'تم تجاوز عدد المحاولات المسموح بها مؤقتاً. يرجى المحاولة بعد دقيقة.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { token, status, attendingCount, notes, needsWheelchair } = body;

    if (!token || !status) {
      return NextResponse.json({ success: false, message: 'بيانات غير مكتملة' }, { status: 400 });
    }

    const partyData = await getPartyByInvitationToken(token);
    if (!partyData) {
      return NextResponse.json({ success: false, message: 'رمز الدعوة غير صالح' }, { status: 404 });
    }

    const result = await submitPartyRSVP(
      partyData.party.id,
      status,
      attendingCount || 1,
      notes,
      needsWheelchair
    );

    return NextResponse.json({
      success: result.success,
      message: result.message,
      entryPass: result.entryPass,
      party: partyData.party,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
