import { getDefaultEvent, getEventStats, getCheckInLogs, getWishes } from '@/lib/db/store';
import { LiveMonitor } from '@/components/LiveMonitor';

export default async function LiveMonitorPage() {
  const event = await getDefaultEvent();
  const stats = await getEventStats(event.id);
  const logs = await getCheckInLogs(event.id);
  const wishes = await getWishes(event.id, true);

  return (
    <LiveMonitor
      initialEvent={event}
      initialStats={stats}
      initialLogs={logs}
      initialWishes={wishes}
    />
  );
}
