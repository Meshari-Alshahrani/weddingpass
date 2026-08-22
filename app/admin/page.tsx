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

export default async function AdminPage() {
  const event = await getDefaultEvent();
  const parties = await getAllParties(event.id);
  const stats = await getEventStats(event.id);
  const logs = await getCheckInLogs(event.id);
  const groupLinks = await getAllGroupLinks(event.id);
  const wishes = await getWishes(event.id);
  const moments = await getMoments(event.id);

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
}
