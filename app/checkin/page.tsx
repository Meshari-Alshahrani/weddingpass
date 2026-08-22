import { getDefaultEvent } from '@/lib/db/store';
import { GateScanner } from '@/components/GateScanner';
import { WeddingEvent } from '@/types/database';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const FALLBACK_EVENT: WeddingEvent = {
  id: 'a0000000-0000-0000-0000-000000000001',
  slug: 'royal-wedding-2026',
  groom_name: 'سلمان بن فهد العتيبي',
  bride_name: 'نورية بنت عبدالله آل سعود',
  event_date: '2026-10-24',
  event_time: '20:00:00',
  venue_name: 'قاعة فندق الريتز كارلتون - الرياض',
  venue_address: 'طريق مكة المكرمة، الهدا، الرياض',
  venue_maps_url: 'https://maps.google.com/?q=Ritz+Carlton+Riyadh',
  welcome_verse: 'وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً',
  theme_id: 'classic_gold',
  rsvp_mode: 'count',
  gate_pin: '2026',
  timeline_reception: '08:00 م',
  timeline_ardah: '09:30 م',
  timeline_dinner: '10:30 م',
  created_at: new Date().toISOString(),
};

export default async function CheckInPage() {
  try {
    const event = (await getDefaultEvent()) || FALLBACK_EVENT;
    const safeEvent = {
      ...event,
      gate_pin: undefined, // Strip secret PIN from client bundle
    };

    return <GateScanner initialEvent={safeEvent} />;
  } catch {
    return <GateScanner initialEvent={{ ...FALLBACK_EVENT, gate_pin: undefined }} />;
  }
}
