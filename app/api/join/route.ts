import { NextRequest, NextResponse } from 'next/server';
import {
  getGroupLinkBySlug,
  registerGroupGuest,
  recoverGuestPassByPhone,
  getDefaultEvent,
} from '@/lib/db/store';
import { checkDistributedRateLimit } from '@/lib/security/rateLimiter';
import {
  toPublicEntryPass,
  toPublicEvent,
  toPublicGroupInvite,
  toPublicInvitationParty,
} from '@/lib/presentation/publicDtos';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const recoverPhone = searchParams.get('recoverPhone');

    // Phone recovery request
    if (recoverPhone) {
      const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
      const rateLimit = await checkDistributedRateLimit(`recover_${ip}`, 15, 60000); // 15 phone searches per minute
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { success: false, message: 'تم تجاوز عدد محاولات البحث المسموح بها مؤقتاً.' },
          { status: 429 }
        );
      }

      const event = await getDefaultEvent();
      const result = await recoverGuestPassByPhone(event.id, recoverPhone);
      return NextResponse.json({
        success: result.success,
        message: result.message,
        party: result.party ? toPublicInvitationParty(result.party) : undefined,
        entryPass: toPublicEntryPass(result.entryPass),
      });
    }

    // Group info request by slug
    if (!slug) {
      return NextResponse.json({ success: false, message: 'محدد المجموعة غير موجود' }, { status: 400 });
    }

    const data = await getGroupLinkBySlug(slug);
    if (!data) {
      return NextResponse.json({ success: false, message: 'رابط المجموعة غير صالح أو تم إيقافه' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      group: toPublicGroupInvite(data.group),
      event: toPublicEvent(data.event),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = await checkDistributedRateLimit(`join_${ip}`, 20, 60000); // 20 registrations per minute per IP
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'تم تجاوز عدد طلبات التسجيل المسموح بها مؤقتاً. يرجى الانتظار قليلاً.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { slug, guestName, guestPhone, seatsCount, notes } = body;

    if (!slug || !guestName) {
      return NextResponse.json(
        { success: false, message: 'يرجى كتابة الاسم الكامل' },
        { status: 400 }
      );
    }

    const result = await registerGroupGuest(
      slug,
      guestName,
      guestPhone || '',
      seatsCount || 1,
      notes
    );

    return NextResponse.json({
      success: result.success,
      code: result.code,
      message: result.message,
      party: result.party ? toPublicInvitationParty(result.party) : undefined,
      entryPass: toPublicEntryPass(result.entryPass),
      remainingSeats: result.remainingSeats,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
