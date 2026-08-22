import { getPartyByInvitationToken } from '@/lib/db/store';
import { LuxuryInvitation } from '@/components/LuxuryInvitation';
import { notFound } from 'next/navigation';
import { AlertCircle, Search } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitationPage({ params }: PageProps) {
  const { token } = await params;

  if (!token) {
    return notFound();
  }

  const data = await getPartyByInvitationToken(token);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-3xl p-8 shadow-2xl space-y-4">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold font-serif gold-gradient-text">عذراً، لم يتم العثور على الدعوة</h1>
          <p className="text-xs text-amber-200/70 leading-relaxed">
            الرابط الذي قمت بفتحه قد يكون غير مكتمل أو منتهي الصلاحية. يرجى التأكد من الضغط على الرابط الكامل في رسالة الواتساب.
          </p>
          <div className="pt-4">
            <Link
              href="/"
              className="inline-block py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 border border-slate-700 transition-colors"
            >
              العودة للرئيسية
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LuxuryInvitation
      party={data.party}
      event={data.event}
      initialEntryPass={data.entryPass}
      invitationToken={token}
    />
  );
}
