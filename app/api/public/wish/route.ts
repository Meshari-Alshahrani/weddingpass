import { NextRequest, NextResponse } from 'next/server';
import { getDefaultEvent, addWish } from '@/lib/db/store';
import { checkDistributedRateLimit } from '@/lib/security/rateLimiter';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = await checkDistributedRateLimit(`public_wish_${ip}`, 10, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'تم إرسال عدد كبير من التهاني، يرجى الانتظار دقيقة' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { partyName, message } = body;

    if (!message || typeof message !== 'string' || !partyName || typeof partyName !== 'string') {
      return NextResponse.json(
        { success: false, message: 'يرجى كتابة الاسم ورسالة التهنئة' },
        { status: 400 }
      );
    }

    const cleanName = partyName.replace(/[<>"']/g, '').trim().slice(0, 80);
    const cleanMessage = message.replace(/[<>"']/g, '').trim().slice(0, 500);

    if (cleanName.length < 2 || cleanMessage.length < 2) {
      return NextResponse.json(
        { success: false, message: 'يرجى كتابة اسم ورسالة صالحة' },
        { status: 400 }
      );
    }

    const event = await getDefaultEvent();
    // Do not accept partyId from public client to prevent identity spoofing
    const wish = await addWish(event.id, cleanName, cleanMessage, undefined, true);

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
