import { NextRequest, NextResponse } from 'next/server';
import { getDefaultEvent, addMoment } from '@/lib/db/store';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { validateImagePayload } from '@/lib/security/imageValidation';

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

    // Enforce payload bounds (max 5 MB)
    if (!mediaUrl || typeof mediaUrl !== 'string') {
      return NextResponse.json(
        { success: false, message: 'يرجى تقديم ملف أو رابط الصورة' },
        { status: 400 }
      );
    }

    if (mediaUrl.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: 'حجم الصورة كبير جداً (الحد الأقصى 5 ميجابايت)' },
        { status: 413 }
      );
    }

    // Mandatory Image Validation (Binary Magic Bytes for Base64, and Safe Extension/Domain for URLs)
    const imageCheck = validateImagePayload(mediaUrl);
    if (!imageCheck.valid) {
      return NextResponse.json(
        { success: false, message: imageCheck.error || 'الملف المرفوع ليس صورة صالحة' },
        { status: 400 }
      );
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
