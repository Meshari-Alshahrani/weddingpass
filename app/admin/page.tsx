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
import { requireAdminSession } from '@/lib/security/adminDal';
import { FALLBACK_EVENT, isProductionRuntime } from '@/lib/config/fallbackEvent';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const EMPTY_STATS = {
  totalInvited: 0,
  expectedGuests: 0,
  checkedInGuests: 0,
  confirmedParties: 0,
  declinedParties: 0,
  pendingParties: 0,
};

/**
 * Explicit Fail-Closed screen: production never renders demo data when the
 * database is unreachable or unseeded (ADR-017).
 */
function UnconfiguredScreen() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-3xl p-8 text-center space-y-3">
        <h1 className="text-lg font-bold gold-gradient-text">لوحة الإدارة غير مهيأة بعد</h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          تعذر تحميل بيانات الفعالية من قاعدة البيانات. تأكد من تطبيق ملفات
          <span className="font-mono text-amber-300"> supabase/migrations </span>
          وإنشاء الفعالية قبل فتح اللوحة.
        </p>
      </div>
    </div>
  );
}

export default async function AdminPage() {
  // REAL authorization boundary — must run before any data access so guest
  // PII never enters an unauthenticated response/RSC payload.
  await requireAdminSession();

  try {
    const event = await getDefaultEvent();
    const [parties, stats, logs, groupLinks, wishes, moments] = await Promise.all([
      getAllParties(event.id).catch(() => []),
      getEventStats(event.id).catch(() => EMPTY_STATS),
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
    if (isProductionRuntime()) {
      return <UnconfiguredScreen />;
    }
    // Development convenience only — never rendered in production.
    return (
      <AdminDashboard
        initialEvent={FALLBACK_EVENT}
        initialParties={[]}
        initialStats={EMPTY_STATS}
        initialLogs={[]}
        initialGroupLinks={[]}
        initialWishes={[]}
        initialMoments={[]}
      />
    );
  }
}
