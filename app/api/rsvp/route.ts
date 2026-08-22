import { NextRequest, NextResponse } from 'next/server';
import { submitPartyRSVP, getPartyByInvitationToken } from '@/lib/db/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, status, attendingCount, notes } = body;

    if (!token || !status) {
      return NextResponse.json({ success: false, message: 'بيانات غير مكتملة' }, { status: 400 });
    }

    const partyData = await getPartyByInvitationToken(token);
    if (!partyData) {
      return NextResponse.json({ success: false, message: 'رمز الدعوة غير صالح' }, { status: 404 });
    }

    const result = await submitPartyRSVP(partyData.party.id, status, attendingCount || 1, notes);

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
