import { getGroupLinkBySlug } from '@/lib/db/store';
import { GroupInviteView } from '@/components/GroupInviteView';
import { notFound } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function GroupJoinPage({ params }: PageProps) {
  const { slug } = await params;

  if (!slug) {
    return notFound();
  }

  const data = await getGroupLinkBySlug(slug);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-3xl p-8 shadow-2xl space-y-4">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold font-serif gold-gradient-text">عذراً، رابط المجموعة غير صالح</h1>
          <p className="text-xs text-amber-200/70 leading-relaxed">
            قد يكون تم إيقاف هذا الرابط أو تعديله من قِبل المنظم. يرجى مراجعة صاحب الدعوة للتأكد من الرابط الصحيح.
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

  return <GroupInviteView group={data.group} event={data.event} />;
}
