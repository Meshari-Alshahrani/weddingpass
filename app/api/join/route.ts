import { NextRequest, NextResponse } from 'next/server';
import {
  getGroupLinkBySlug,
  registerGroupGuest,
  recoverGuestPassByPhone,
  getActivePassesForOfflineCache,
  getDefaultEvent,
} from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const recoverPhone = searchParams.get('recoverPhone');
    const offlineCache = searchParams.get('offlineCache');

    // Offline cache request for gate scanner
    if (offlineCache === 'true') {
      const event = await getDefaultEvent();
      const passes = await getActivePassesForOfflineCache(event.id);
      return NextResponse.json({ success: true, passes });
    }

    // Phone recovery request
    if (recoverPhone) {
      const event = await getDefaultEvent();
      const result = await recoverGuestPassByPhone(event.id, recoverPhone);
      return NextResponse.json(result);
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
      group: data.group,
      event: data.event,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
