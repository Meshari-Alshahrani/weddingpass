import { NextRequest, NextResponse } from 'next/server';
import {
  getDefaultEvent,
  getAllParties,
  getEventStats,
  getCheckInLogs,
  bulkAddParties,
  updatePartyDispatch,
  revokePass,
  regeneratePass,
  updateEventSettings,
  getAllGroupLinks,
  createGroupLink,
} from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const event = await getDefaultEvent();
    const parties = await getAllParties(event.id);
    const stats = await getEventStats(event.id);
    const logs = await getCheckInLogs(event.id);
    const groupLinks = await getAllGroupLinks(event.id);

    return NextResponse.json({
      success: true,
      event,
      parties,
      stats,
      logs: logs.slice(0, 50),
      groupLinks,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    const event = await getDefaultEvent();

    if (action === 'create_group_link') {
      const { groupName, slug, limitMode, maxCapacity, maxSeatsPerGuest, section } = body;
      if (!groupName || !slug) {
        return NextResponse.json({ success: false, message: 'يرجى كتابة اسم القروب والرابط' }, { status: 400 });
      }

      const newGroup = await createGroupLink(
        event.id,
        groupName,
        slug,
        limitMode || 'warning',
        maxCapacity,
        maxSeatsPerGuest || 2,
        section || 'general'
      );

      return NextResponse.json({
        success: true,
        group: newGroup,
        message: 'تم إنشاء رابط القروب بنجاح',
      });
    }

    if (action === 'bulk_import') {
      const { guests } = body;
      if (!Array.isArray(guests) || guests.length === 0) {
        return NextResponse.json({ success: false, message: 'قائمة الضيوف فارغة' }, { status: 400 });
      }

      const result = await bulkAddParties(event.id, guests);
      return NextResponse.json({
        success: true,
        message: `تم استيراد ${result.addedCount} دعوة وتوليد الروابط بنجاح`,
        parties: result.parties,
      });
    }

    if (action === 'update_dispatch') {
      const { partyId, status } = body;
      await updatePartyDispatch(partyId, status);
      return NextResponse.json({ success: true });
    }

    if (action === 'revoke_pass') {
      const { partyId } = body;
      const success = await revokePass(partyId);
      return NextResponse.json({ success, message: success ? 'تم إلغاء صلاحية البطاقة' : 'لم يتم العثور على البطاقة' });
    }

    if (action === 'regenerate_pass') {
      const { partyId } = body;
      const newPass = await regeneratePass(partyId);
      return NextResponse.json({
        success: Boolean(newPass),
        entryPass: newPass,
        message: 'تم إصدار بطاقة جديدة وإبطال القديمة بنجاح',
      });
    }

    if (action === 'update_event') {
      const { eventData } = body;
      const updated = await updateEventSettings(event.id, eventData);
      return NextResponse.json({
        success: Boolean(updated),
        event: updated,
        message: 'تم تحديث بيانات الحفل والدعوة بنجاح',
      });
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
