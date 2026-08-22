import { NextRequest, NextResponse } from 'next/server';
import { getDefaultEvent, addMoment } from '@/lib/db/store';
import { checkRateLimit } from '@/lib/security/rateLimiter';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = checkRateLimit(`public_moment_${ip}`, 10, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'تم تجاوز الحد المسموح لرفع الصور. يرجى الانتظار قليلاً.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { uploaderName, mediaUrl, caption, section, uploaderPhone } = body;

    if (!mediaUrl || typeof mediaUrl !== 'string') {
      return NextResponse.json(
        { success: false, message: 'يرجى تقديم رابط أو ملف الصورة' },
        { status: 400 }
      );
    }

    const event = await getDefaultEvent();
    const cleanName = (uploaderName || 'ضيف كريم').replace(/[<>"']/g, '').trim();
    const cleanCaption = (caption || '').replace(/[<>"']/g, '').trim();

    const moment = await addMoment(
      event.id,
      cleanName,
      mediaUrl,
      cleanCaption,
      section || 'men',
      uploaderPhone
    );

    return NextResponse.json({
      success: true,
      moment,
      message: 'تم إرسال الصورة بنجاح وستظهر في ألبوم الحفل بعد مراجعة المشرف 📸',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
