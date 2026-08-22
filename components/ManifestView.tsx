'use client';

import React from 'react';
import Link from 'next/link';
import { Printer, ArrowRight } from 'lucide-react';
import { WeddingEvent, Party } from '@/types/database';

interface ManifestViewProps {
  event: WeddingEvent;
  confirmedGuests: Party[];
}

export function ManifestView({ event, confirmedGuests }: ManifestViewProps) {
  return (
    <div className="p-6 sm:p-10 bg-white text-slate-950 min-h-screen font-sans" dir="rtl">
      {/* Print Specific CSS */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            font-size: 11pt !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #333 !important;
            padding: 6px 8px !important;
            text-align: right !important;
          }
          th {
            background-color: #f0f0f0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Top Action Bar (Hidden when printing) */}
      <div className="no-print flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة للوحة التحكم</span>
          </Link>
          <div>
            <h1 className="text-base font-bold text-slate-900">
              📋 كشف البوابة الورقي المعتمد لحالات الطوارئ (Plan B)
            </h1>
            <p className="text-xs text-slate-500">
              كشف رسمي بأسماء المدعوين وأرقام طاولاتهم للتحضير اليدوي بالقلم عند أي انقطاع
            </p>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="py-2.5 px-5 rounded-xl bg-slate-950 text-white hover:bg-slate-800 text-xs font-bold flex items-center gap-2 shadow-md transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة الكشف الورقي (A4 / PDF)</span>
        </button>
      </div>

      {/* Printable Header */}
      <div className="text-center mb-6 border-b-2 border-slate-900 pb-4">
        <h2 className="text-xl font-bold font-serif">
          كشف الحضور الرسمي واستقبال الضيوف • حفل زفاف {event.groom_name} & {event.bride_name}
        </h2>
        <div className="flex justify-center gap-6 text-xs text-slate-700 mt-2 font-semibold">
          <span>📅 التاريخ: {event.event_date}</span>
          <span>🏛️ القاعة: {event.venue_name}</span>
          <span>👥 إجمالي المدعوين المسجلين: {confirmedGuests.length} مدعو</span>
        </div>
      </div>

      {/* Guests Table */}
      <table className="w-full border-collapse border border-slate-900 text-xs">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-900">
            <th className="border border-slate-900 p-2 w-14 text-center">التحضير</th>
            <th className="border border-slate-900 p-2">اسم المدعو الكريم / العائلة</th>
            <th className="border border-slate-900 p-2 w-28 text-center">رقم الجوال</th>
            <th className="border border-slate-900 p-2 w-14 text-center">المقاعد</th>
            <th className="border border-slate-900 p-2 w-28 text-center">مكان الجلوس</th>
            <th className="border border-slate-900 p-2 w-24 text-center">الداعي</th>
            <th className="border border-slate-900 p-2 w-20 text-center">القسم</th>
            <th className="border border-slate-900 p-2 w-32">ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          {confirmedGuests.map((guest) => (
            <tr key={guest.id} className="border-b border-slate-300">
              <td className="border border-slate-900 p-2 text-center text-base">⭕</td>
              <td className="border border-slate-900 p-2 font-bold">{guest.party_name}</td>
              <td className="border border-slate-900 p-2 font-mono text-center" dir="ltr">
                {guest.primary_phone || '-'}
              </td>
              <td className="border border-slate-900 p-2 text-center font-bold">
                {guest.confirmed_count || guest.allowed_count}
              </td>
              <td className="border border-slate-900 p-2 text-center font-semibold">
                {guest.table_number || 'عام'}
              </td>
              <td className="border border-slate-900 p-2 text-center">{guest.host_name || 'العريس'}</td>
              <td className="border border-slate-900 p-2 text-center font-semibold">
                {guest.section === 'men' ? 'رجال' : guest.section === 'women' ? 'نساء' : 'VIP'}
              </td>
              <td className="border border-slate-900 p-2 text-[10px] text-slate-600">
                {guest.needs_wheelchair && '♿ يحتاج عربة تنقل • '}
                {guest.notes || ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer Signatures */}
      <div className="mt-8 pt-4 border-t border-slate-400 flex justify-between text-xs text-slate-600">
        <div>مسؤول الاستقبال: .......................................</div>
        <div>التوقيع: .......................................</div>
        <div>التاريخ والوقت: {new Date().toLocaleDateString('ar-SA')}</div>
      </div>
    </div>
  );
}
