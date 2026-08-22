import { NextRequest, NextResponse } from 'next/server';
import { getDefaultEvent } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const event = await getDefaultEvent();
    const { searchParams } = new URL(req.url);
    const guestName = searchParams.get('guest') || '';

    const title = `حفل زفاف ${event.groom_name} و ${event.bride_name}`;
    const description = guestName
      ? `يشرفنا حضوركم لحفل زفافنا في ${event.venue_name} - دعوة كريمة للمدعو: ${guestName}`
      : `يشرفنا حضوركم لحفل زفافنا في ${event.venue_name}`;
    const location = event.venue_address ? `${event.venue_name}، ${event.venue_address}` : event.venue_name;

    // Dates in YYYYMMDDTHHMMSS format (Local time in Asia/Riyadh)
    const cleanDate = event.event_date.replace(/-/g, '');
    const cleanTime = event.event_time.replace(/:/g, '').slice(0, 6);
    const startStr = `${cleanDate}T${cleanTime}`;
    // End time 4 hours later
    const endStr = `${cleanDate}T235900`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//WeddingPass//AR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VTIMEZONE',
      'TZID:Asia/Riyadh',
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      'TZOFFSETFROM:+0300',
      'TZOFFSETTO:+0300',
      'TZNAME:AST',
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      `UID:wedding-${event.id}-${Date.now()}@weddingpass.sa`,
      `DTSTAMP:${cleanDate}T000000Z`,
      `DTSTART;TZID=Asia/Riyadh:${startStr}`,
      `DTEND;TZID=Asia/Riyadh:${endStr}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      event.venue_maps_url ? `URL:${event.venue_maps_url}` : '',
      'STATUS:CONFIRMED',
      // Alarm 1: 24 Hours prior
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:تذكير: حفل زفاف ${event.groom_name} و ${event.bride_name} غداً`,
      'END:VALARM',
      // Alarm 2: 2 Hours prior
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      `DESCRIPTION:تذكير: حفل زفاف ${event.groom_name} و ${event.bride_name} بعد ساعتين`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .join('\r\n');

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="wedding-invitation.ics"',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
