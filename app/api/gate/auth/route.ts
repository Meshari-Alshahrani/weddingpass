import { NextRequest, NextResponse } from 'next/server';
import { getDefaultEvent } from '@/lib/db/store';
import { constantTimeCompare } from '@/lib/crypto/tokens';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { createGateSessionToken, GateSessionPayload, GateRole } from '@/lib/security/gateAuth';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = checkRateLimit(`gate_auth_${ip}`, 10, 60000); // 10 attempts per min
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, code: 'RATE_LIMIT_EXCEEDED', message: 'تم تجاوز عدد محاولات إدخال الرمز. يرجى الانتظار دقيقة.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { pin, stationName, operatorName, gateSection, stationId, operatorId, role } = body;

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { success: false, code: 'INVALID_PIN', message: 'يرجى إدخال رمز الـ PIN الخاص بالبوابة' },
        { status: 400 }
      );
    }

    const event = await getDefaultEvent();
    const serverGatePin = event.gate_pin || '2026';
    const supervisorPin = process.env.SUPERVISOR_PIN || '9900';

    let determinedRole: GateRole = 'operator';
    let pinValid = false;

    // Check standard Gate PIN
    if (constantTimeCompare(pin.trim(), serverGatePin.trim())) {
      pinValid = true;
      determinedRole = role === 'supervisor' ? 'supervisor' : 'operator';
    }

    // Check Supervisor Master PIN
    if (constantTimeCompare(pin.trim(), supervisorPin.trim())) {
      pinValid = true;
      determinedRole = 'supervisor';
    }

    if (!pinValid) {
      return NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: 'رمز الدخول غير صحيح' },
        { status: 401 }
      );
    }

    // Session duration: 12 hours
    const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
    const resolvedStationId = stationId || `stn_${(stationName || 'gate1').replace(/\s+/g, '_')}`;
    const resolvedOperatorId = operatorId || `op_${(operatorName || 'staff').replace(/\s+/g, '_')}`;

    const sessionPayload: GateSessionPayload = {
      eventId: event.id,
      stationId: resolvedStationId,
      stationName: stationName?.trim() || 'بوابة 1',
      operatorId: resolvedOperatorId,
      operatorName: operatorName?.trim() || 'مشرف البوابة',
      role: determinedRole,
      gateSection: (gateSection === 'women' ? 'women' : gateSection === 'general' ? 'general' : 'men'),
      expiresAt,
    };

    const sessionToken = createGateSessionToken(sessionPayload);

    const response = NextResponse.json({
      success: true,
      code: 'AUTHENTICATED',
      message: 'تم التحقق بنجاح وتفعيل جلسة البوابة المشفرة',
      sessionToken,
      stationId: sessionPayload.stationId,
      stationName: sessionPayload.stationName,
      operatorId: sessionPayload.operatorId,
      operatorName: sessionPayload.operatorName,
      role: sessionPayload.role,
      gateSection: sessionPayload.gateSection,
    });

    // Set HttpOnly Secure SameSite Cookie
    response.cookies.set('gate_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 12 * 60 * 60, // 12 hours
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: err.message || 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
