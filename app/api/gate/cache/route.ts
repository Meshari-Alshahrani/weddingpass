import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedGateSession } from '@/lib/security/gateAuth';
import { getActivePassesForOfflineCache } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    // 1. Mandatory Gate Authentication
    const session = await getVerifiedGateSession(req);
    if (!session) {
      return NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: 'جلسة البوابة غير مصرحة لتحميل الكاش المحلي' },
        { status: 401 }
      );
    }

    // 2. Retrieve only safe hashed records for offline verifications
    const offlineRecords = await getActivePassesForOfflineCache(session.eventId);

    // Sanitization: Ensure NO raw tokens are leaked
    const safeRecords = offlineRecords.map((r) => ({
      partyId: r.partyId,
      partyName: r.partyName,
      passTokenHash: r.passTokenHash,
      tableNumber: r.tableNumber || null,
      confirmedCount: r.confirmedCount || 1,
      section: r.section || 'men',
      isVip: (r.section === 'vip' || r.partyName?.includes('الشيخ') || r.partyName?.includes('سعادة')),
      needsWheelchair: Boolean(r.needsWheelchair),
      isCheckedIn: Boolean(r.isCheckedIn),
    }));

    return NextResponse.json({
      success: true,
      eventId: session.eventId,
      stationName: session.stationName,
      totalCount: safeRecords.length,
      cachedAt: new Date().toISOString(),
      records: safeRecords,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: err.message || 'حدث خطأ أثناء إعداد كاش البوابة' },
      { status: 500 }
    );
  }
}
