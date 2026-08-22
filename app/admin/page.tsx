import {
  getDefaultEvent,
  getAllParties,
  getEventStats,
  getCheckInLogs,
  getAllGroupLinks,
  getWishes,
  getMoments,
} from '@/lib/db/store';
import { AdminDashboard } from '@/components/AdminDashboard';
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

export default async function AdminPage() {
  try {
    const event = (await getDefaultEvent()) || FALLBACK_EVENT;
    const [parties, stats, logs, groupLinks, wishes, moments] = await Promise.all([
      getAllParties(event.id).catch(() => []),
      getEventStats(event.id).catch(() => ({
        totalInvited: 0,
        expectedGuests: 0,
        checkedInGuests: 0,
        confirmedParties: 0,
        declinedParties: 0,
        pendingParties: 0,
      })),
      getCheckInLogs(event.id).catch(() => []),
      getAllGroupLinks(event.id).catch(() => []),
      getWishes(event.id).catch(() => []),
      getMoments(event.id).catch(() => []),
    ]);

    return (
      <AdminDashboard
        initialEvent={event}
        initialParties={parties}
        initialStats={stats}
        initialLogs={logs}
        initialGroupLinks={groupLinks}
        initialWishes={wishes}
        initialMoments={moments}
      />
    );
  } catch (err: any) {
    console.error('AdminPage Server Component Render Error:', err);
    return (
      <AdminDashboard
        initialEvent={FALLBACK_EVENT}
        initialParties={[]}
        initialStats={{
          totalInvited: 0,
          expectedGuests: 0,
          checkedInGuests: 0,
          confirmedParties: 0,
          declinedParties: 0,
          pendingParties: 0,
        }}
        initialLogs={[]}
        initialGroupLinks={[]}
        initialWishes={[]}
        initialMoments={[]}
      />
    );
  }
}
