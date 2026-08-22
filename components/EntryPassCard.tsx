'use client';

import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, ShieldCheck, Sparkles, MapPin, Calendar, Clock, Users, CalendarPlus, Smartphone } from 'lucide-react';
import { toPng } from 'html-to-image';

interface EntryPassCardProps {
  partyName: string;
  confirmedCount: number;
  section: string;
  passToken: string;
  eventGroom: string;
  eventBride: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
}

export function EntryPassCard({
  partyName,
  confirmedCount,
  section,
  passToken,
  eventGroom,
  eventBride,
  eventDate,
  eventTime,
  venueName,
}: EntryPassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const getSectionLabel = (sec: string) => {
    switch (sec) {
      case 'men': return 'قسم الرجال';
      case 'women': return 'قسم النساء';
      case 'vip': return 'كبار الشخصيات (VIP)';
      case 'groom_family': return 'أهل العريس';
      case 'bride_family': return 'أهل العروس';
      default: return 'الدعوة العامة';
    }
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    try {
      setDownloading(true);
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        quality: 0.98,
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `WeddingPass-${partyName.replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download card:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleAddToCalendar = () => {
    const title = `حفل زفاف ${eventGroom} و ${eventBride}`;
    const description = `بطاقة دخول خاصة بالمدعو: ${partyName} (${confirmedCount} أشخاص). الموقع: ${venueName}`;
    const location = venueName;
    const startStr = `${eventDate.replace(/-/g, '')}T${eventTime.replace(/:/g, '')}Z`;
    const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//WeddingPass//AR
BEGIN:VEVENT
SUMMARY:${title}
DESCRIPTION:${description}
LOCATION:${location}
DTSTART:${startStr}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wedding-entry-pass-${partyName}.ics`;
    link.click();
  };

  return (
    <div className="w-full max-w-md mx-auto my-6 space-y-4">
      {/* Boarding Pass Container to be downloaded */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/40 p-6 text-amber-100 shadow-[0_0_40px_-10px_rgba(212,175,55,0.35)]"
      >
        {/* Top Ornamental Header */}
        <div className="text-center pb-4 border-b border-amber-500/20">
          <div className="flex items-center justify-center gap-2 text-xs text-amber-400/80 uppercase tracking-widest font-semibold mb-1">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>بطاقة دخول رسمية • WEDDINGPASS</span>
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold font-serif gold-gradient-text">
            حفل زفاف {eventGroom} & {eventBride}
          </h2>
        </div>

        {/* Guest Details */}
        <div className="my-5 bg-slate-950/60 rounded-2xl p-4 border border-amber-500/20 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-amber-300/70">المدعو الكريم</p>
              <h3 className="text-lg font-bold text-amber-100 mt-0.5">{partyName}</h3>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-semibold text-amber-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{confirmedCount} {confirmedCount === 1 ? 'شخص' : 'أشخاص'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-500/10 text-xs">
            <div>
              <span className="text-amber-300/60 block">القسم / البوابة:</span>
              <span className="font-semibold text-amber-200">{getSectionLabel(section)}</span>
            </div>
            <div>
              <span className="text-amber-300/60 block">الموقع:</span>
              <span className="font-semibold text-amber-200 truncate block">{venueName}</span>
            </div>
          </div>
        </div>

        {/* QR Code Presentation */}
        <div className="bg-white rounded-2xl p-5 my-4 flex flex-col items-center justify-center shadow-inner border border-amber-300/40">
          <div className="p-2 bg-white rounded-xl">
            <QRCodeSVG
              value={passToken}
              size={190}
              level="H"
              includeMargin={false}
              fgColor="#0F172A"
              bgColor="#FFFFFF"
            />
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-slate-800 text-xs font-bold bg-amber-50 px-3 py-1 rounded-full border border-amber-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>رمز دخول خاص وموثق</span>
          </div>
        </div>

        {/* Notice Footer */}
        <div className="text-center pt-2 text-[11px] text-amber-200/60 leading-relaxed">
          <p>يرجى إبراز هذا الرمز عند بوابة القاعة لموظف الاستقبال عند الوصول.</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleDownloadImage}
          disabled={downloading}
          className="w-full py-3.5 px-4 rounded-xl gold-gradient-bg text-slate-950 font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
        >
          <Download className="w-5 h-5" />
          <span>{downloading ? 'جاري حفظ الصورة...' : 'حفظ بطاقة الدخول في الصور (PNG)'}</span>
        </button>

        <button
          onClick={handleAddToCalendar}
          className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <CalendarPlus className="w-4 h-4 text-amber-400" />
          <span>إضافة التذكير للتقويم والمحفظة (Apple & Google)</span>
        </button>
      </div>
    </div>
  );
}
