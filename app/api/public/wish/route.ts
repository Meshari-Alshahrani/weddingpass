import { NextRequest, NextResponse } from 'next/server';
import { getDefaultEvent, addWish } from '@/lib/db/store';
import { checkRateLimit } from '@/lib/security/rateLimiter';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = checkRateLimit(`public_wish_${ip}`, 10, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'تم إرسال عدد كبير من التهاني، يرجى الانتظار قليلاً' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { partyName, message, partyId } = body;

    if (!message || !partyName) {
      return NextResponse.json(
        { success: false, message: 'يرجى كتابة الاسم ورسالة التهنئة' },
        { status: 400 }
      );
    }

    const event = await getDefaultEvent();
    const cleanName = partyName.replace(/[<>"']/g, '').trim();
    const cleanMessage = message.replace(/[<>"']/g, '').trim();

    const wish = await addWish(event.id, cleanName, cleanMessage, partyId, true);

    return NextResponse.json({
      success: true,
      wish,
      message: 'تم إرسال تهنئتكم وستظهر في شاشة القاعة، شكراً لمشاعركم الجميلة 🌹',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
