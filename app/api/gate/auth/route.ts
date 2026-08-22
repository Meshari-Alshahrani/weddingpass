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
    const { pin, stationName, operatorName, gateSection, stationId, operatorId } = body;

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { success: false, code: 'INVALID_PIN', message: 'يرجى إدخال رمز الـ PIN الخاص بالبوابة' },
        { status: 400 }
      );
    }

    const event = await getDefaultEvent();
    const serverGatePin = event.gate_pin;
    if (!serverGatePin && process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY ERROR: Event Gate PIN is not configured in production!');
    }
    const resolvedGatePin = serverGatePin || '2026';

    const supervisorPin = process.env.SUPERVISOR_PIN;
    if (!supervisorPin && process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY ERROR: SUPERVISOR_PIN environment variable is missing in production!');
    }
    const resolvedSupervisorPin = supervisorPin || 'dev_sup_9900_weddingpass';

    let determinedRole: GateRole = 'operator';
    let pinValid = false;

    // 1. Check Supervisor Master PIN (Exclusively grants 'supervisor' role)
    if (constantTimeCompare(pin.trim(), resolvedSupervisorPin.trim())) {
      pinValid = true;
      determinedRole = 'supervisor';
    } 
    // 2. Check Standard Gate Station PIN (Exclusively grants 'operator' role - NEVER escalated from client body!)
    else if (constantTimeCompare(pin.trim(), resolvedGatePin.trim())) {
      pinValid = true;
      determinedRole = 'operator';
    }

    if (!pinValid) {
      return NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: 'رمز الدخول غير صحيح' },
        { status: 401 }
      );
    }

    // Session duration: 4 hours (Strict session lifecycle)
    const expiresAt = Date.now() + 4 * 60 * 60 * 1000;
    const cleanStationName = (stationName || 'بوابة رئيسية').replace(/[<>"']/g, '').trim();
    const cleanOperatorName = (operatorName || 'مشرف البوابة').replace(/[<>"']/g, '').trim();
    const resolvedStationId = stationId || `stn_${cleanStationName.replace(/\s+/g, '_')}`;
    const resolvedOperatorId = operatorId || `op_${cleanOperatorName.replace(/\s+/g, '_')}`;

    const sessionPayload: GateSessionPayload = {
      eventId: event.id,
      stationId: resolvedStationId,
      stationName: cleanStationName,
      operatorId: resolvedOperatorId,
      operatorName: cleanOperatorName,
      role: determinedRole,
      gateSection: (gateSection === 'women' ? 'women' : gateSection === 'general' ? 'general' : 'men'),
      expiresAt,
    };

    const sessionToken = createGateSessionToken(sessionPayload);

    const response = NextResponse.json({
      success: true,
      code: 'AUTHENTICATED',
      message: determinedRole === 'supervisor' ? 'تم تسجيل الدخول بصلاحية المشرف العام 🛡️' : 'تم التحقق وتفعيل جلسة البوابة 🌹',
      sessionToken,
      stationId: sessionPayload.stationId,
      stationName: sessionPayload.stationName,
      operatorId: sessionPayload.operatorId,
      operatorName: sessionPayload.operatorName,
      role: sessionPayload.role,
      gateSection: sessionPayload.gateSection,
    });

    // Set OWASP Compliant HttpOnly Secure SameSite Cookie (4 hours lifetime)
    const isProd = process.env.NODE_ENV === 'production';
    const cookieName = isProd ? '__Host-gate_session' : 'gate_session';

    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: '/',
      maxAge: 4 * 60 * 60, // 4 hours
    });

    if (!isProd) {
      response.cookies.set('gate_session', sessionToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        path: '/',
        maxAge: 4 * 60 * 60,
      });
    }

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: err.message || 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
