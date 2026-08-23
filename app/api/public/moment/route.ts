import { NextRequest, NextResponse } from 'next/server';
import { getDefaultEvent, addMoment } from '@/lib/db/store';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { validateBase64Image } from '@/lib/security/imageValidation';

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
        { success: false, message: 'يرجى تقديم ملف أو رابط الصورة' },
        { status: 400 }
      );
    }

    // Enforce payload bounds (max 5 MB)
    if (mediaUrl.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: 'حجم الصورة كبير جداً (الحد الأقصى 5 ميجابايت)' },
        { status: 413 }
      );
    }

    // Mandatory Binary Magic Bytes Verification for Data URIs & Base64 uploads
    if (mediaUrl.startsWith('data:') || !mediaUrl.startsWith('http')) {
      const magicCheck = validateBase64Image(mediaUrl);
      if (!magicCheck.valid) {
        return NextResponse.json(
          { success: false, message: magicCheck.error || 'الملف المرفوع ليس صورة صالحة' },
          { status: 400 }
        );
      }
    }

    const cleanName = (typeof uploaderName === 'string' ? uploaderName : 'ضيف كريم')
      .replace(/[<>"']/g, '')
      .trim()
      .slice(0, 80);

    const cleanCaption = (typeof caption === 'string' ? caption : '')
      .replace(/[<>"']/g, '')
      .trim()
      .slice(0, 200);

    const cleanPhone = typeof uploaderPhone === 'string' ? uploaderPhone.trim().slice(0, 20) : undefined;
    const cleanSection = section === 'women' ? 'women' : 'men';

    const event = await getDefaultEvent();
    const moment = await addMoment(
      event.id,
      cleanName,
      mediaUrl,
      cleanCaption,
      cleanSection,
      cleanPhone
    );

    return NextResponse.json({
      success: true,
      moment,
      message: 'تم استلام الصورة بنجاح وستظهر في ألبوم الحفل بعد اعتماد المشرف 📸',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
