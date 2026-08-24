import { getDefaultEvent, getEventStats, getCheckInLogs, getWishes } from '@/lib/db/store';
import { LiveMonitor } from '@/components/LiveMonitor';
import { requireAdminSession } from '@/lib/security/adminDal';
import { FALLBACK_EVENT, isProductionRuntime } from '@/lib/config/fallbackEvent';

export const dynamic = 'force-dynamic';

const EMPTY_STATS = {
  totalInvited: 0,
  expectedGuests: 0,
  checkedInGuests: 0,
  confirmedParties: 0,
  declinedParties: 0,
  pendingParties: 0,
};

function UnconfiguredScreen() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-3xl p-8 text-center space-y-3">
        <h1 className="text-lg font-bold gold-gradient-text">شاشة القاعة غير مهيأة بعد</h1>
        <p className="text-xs text-slate-400 leading-relaxed">تعذر تحميل بيانات الفعالية من قاعدة البيانات.</p>
      </div>
    </div>
  );
}

export default async function LiveMonitorPage() {
  await requireAdminSession();

  try {
    const event = await getDefaultEvent();
    const [stats, logs, wishes] = await Promise.all([
      getEventStats(event.id).catch(() => EMPTY_STATS),
      getCheckInLogs(event.id).catch(() => []),
      getWishes(event.id, true).catch(() => []),
    ]);

    return <LiveMonitor initialEvent={event} initialStats={stats} initialLogs={logs} initialWishes={wishes} />;
  } catch (err) {
    console.error('LiveMonitorPage Render Error:', err);
    if (isProductionRuntime()) {
      return <UnconfiguredScreen />;
    }
    return (
      <LiveMonitor
        initialEvent={FALLBACK_EVENT}
        initialStats={EMPTY_STATS}
        initialLogs={[]}
        initialWishes={[]}
      />
    );
  }
}
