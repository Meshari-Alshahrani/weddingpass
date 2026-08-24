import { getDefaultEvent } from '@/lib/db/store';
import { GateScanner } from '@/components/GateScanner';
import { toPublicGateEvent } from '@/lib/presentation/publicDtos';
import { FALLBACK_EVENT, isProductionRuntime } from '@/lib/config/fallbackEvent';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function UnconfiguredScreen() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-3xl p-8 text-center space-y-3">
        <h1 className="text-lg font-bold gold-gradient-text">محطة البوابة غير مهيأة بعد</h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          تعذر تحميل بيانات الفعالية من قاعدة البيانات. تواصل مع المنظم قبل استقبال الضيوف.
        </p>
      </div>
    </div>
  );
}

export default async function CheckInPage() {
  try {
    const event = await getDefaultEvent();
    return <GateScanner initialEvent={toPublicGateEvent(event)} />;
  } catch (err) {
    console.error('CheckInPage Render Error:', err);
    if (isProductionRuntime()) {
      return <UnconfiguredScreen />;
    }
    return <GateScanner initialEvent={toPublicGateEvent(FALLBACK_EVENT)} />;
  }
}
