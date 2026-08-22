import { NextRequest, NextResponse } from 'next/server';
import { getDefaultEvent } from '@/lib/db/store';
import { constantTimeCompare } from '@/lib/crypto/tokens';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { createGateSessionToken, GateSessionPayload } from '@/lib/security/gateAuth';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = checkRateLimit(`gate_auth_${ip}`, 10, 60000); // 10 attempts per min
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'تم تجاوز عدد محاولات إدخال الرمز. يرجى الانتظار دقيقة.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { pin, stationName, operatorName, gateSection } = body;

    if (!pin) {
      return NextResponse.json(
        { success: false, message: 'يرجى إدخال رمز الـ PIN' },
        { status: 400 }
      );
    }

    const event = await getDefaultEvent();
    const serverPin = event.gate_pin || '2026';

    if (!constantTimeCompare(String(pin).trim(), serverPin.trim())) {
      return NextResponse.json(
        { success: false, message: 'رمز الدخول غير صحيح' },
        { status: 401 }
      );
    }

    // Session valid for 12 hours (wedding night duration)
    const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
    const sessionPayload: GateSessionPayload = {
      eventId: event.id,
      stationName: stationName || 'بوابة 1',
      operatorName: operatorName || 'مشرف البوابة',
      gateSection: gateSection || 'men',
      expiresAt,
    };

    const sessionToken = await createGateSessionToken(sessionPayload);

    return NextResponse.json({
      success: true,
      message: 'تم التحقق بنجاح وتفعيل جلسة البوابة المشفرة',
      sessionToken,
      stationName: sessionPayload.stationName,
      operatorName: sessionPayload.operatorName,
      gateSection: sessionPayload.gateSection,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
