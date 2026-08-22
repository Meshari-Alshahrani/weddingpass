'use client';

import React, { useRef, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Download,
  ShieldCheck,
  Sparkles,
  MapPin,
  Calendar,
  Clock,
  Users,
  CalendarPlus,
  Check,
  ExternalLink,
  Shield,
  Armchair,
  CameraOff,
} from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';

interface EntryPassCardProps {
  partyName: string;
  confirmedCount: number;
  section: string;
  tableNumber?: string | null;
  passToken: string;
  eventGroom: string;
  eventBride: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueMapsUrl?: string | null;
}

export function EntryPassCard({
  partyName,
  confirmedCount,
  section,
  tableNumber,
  passToken,
  eventGroom,
  eventBride,
  eventDate,
  eventTime,
  venueName,
  venueMapsUrl,
}: EntryPassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  // Live Anti-Screenshot Ticking Clock
  const [liveTime, setLiveTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      setLiveTime(
        new Date().toLocaleTimeString('ar-SA', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isWomenSection = section === 'women';

  const getSectionLabel = (sec: string) => {
    switch (sec) {
      case 'men': return 'بوابة قسم الرجال 🤵';
      case 'women': return 'بوابة قسم النساء 🌸';
      case 'vip': return 'كبار الشخصيات (VIP) 👑';
      case 'groom_family': return 'أهل العريس';
      case 'bride_family': return 'أهل العروس';
      default: return 'الدعوة العامة';
    }
  };

  const handleSaveImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    setSavedSuccess(false);

    try {
      const blob = await toBlob(cardRef.current, {
        cacheBust: true,
        quality: 0.98,
        pixelRatio: 2,
      });

      if (blob && navigator.share && navigator.canShare) {
        const file = new File([blob], `WeddingPass-${partyName.replace(/\s+/g, '-')}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `بطاقة دخول حفل زفاف ${eventGroom} و ${eventBride}`,
            text: `بطاقة الدخول الرسمية لـ ${partyName}`,
          });
          setSavedSuccess(true);
          setDownloading(false);
          return;
        }
      }

      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        quality: 0.98,
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `WeddingPass-${partyName.replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
      setSavedSuccess(true);
    } catch (err) {
      console.warn('Share/Download fallback triggered:', err);
    } finally {
      setDownloading(false);
    }
  };

  const cleanDate = eventDate.replace(/-/g, '');
  const cleanTime = eventTime.replace(/:/g, '').slice(0, 4) + '00';
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    `حفل زفاف ${eventGroom} & ${eventBride}`
  )}&dates=${cleanDate}T${cleanTime}/${cleanDate}T235900&details=${encodeURIComponent(
    `يشرفنا حضوركم لحفل زفافنا في ${venueName} - بطاقة دخول للمدعو: ${partyName} (${confirmedCount} أشخاص)`
  )}&location=${encodeURIComponent(venueName)}&ctz=Asia/Riyadh`;

  const appleCalendarUrl = `/api/calendar?guest=${encodeURIComponent(partyName)}`;

  return (
    <div className="w-full max-w-md mx-auto my-4 space-y-4">
      {/* Boarding Pass Container to be captured */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/40 p-6 text-amber-100 shadow-[0_0_40px_-10px_rgba(212,175,55,0.35)]"
      >
        {/* Anti-Screenshot Live Glowing Watermark Header */}
        <div className="flex items-center justify-between pb-3 border-b border-amber-500/20 text-[10px]">
          <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/40 font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>رمز حي مباشر</span>
          </div>

          <div className="text-amber-400/80 font-mono font-bold">
            {liveTime || 'LIVE PASS'}
          </div>
        </div>

        {/* Top Title */}
        <div className="text-center py-3">
          <div className="flex items-center justify-center gap-2 text-xs text-amber-400/80 uppercase tracking-widest font-semibold mb-1">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>بطاقة دخول رسمية • WEDDINGPASS</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold font-serif gold-gradient-text">
            حفل زفاف {eventGroom} & {eventBride}
          </h2>
        </div>

        {/* Guest Info & Table Box */}
        <div className="my-3 bg-slate-950/80 rounded-2xl p-4 border border-amber-500/20 space-y-3">
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
              <span className="text-amber-300/60 block">القسم المخصص:</span>
              <span className="font-semibold text-amber-200">{getSectionLabel(section)}</span>
            </div>
            <div>
              <span className="text-amber-300/60 block">الموقع:</span>
              <span className="font-semibold text-amber-200 truncate block">{venueName}</span>
            </div>
          </div>

          {/* Table Number (If Assigned) */}
          {tableNumber && (
            <div className="pt-2 border-t border-amber-500/10 flex items-center justify-between bg-amber-500/10 p-2 rounded-xl border border-amber-500/30">
              <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold">
                <Armchair className="w-4 h-4 text-amber-400" />
                <span>مكان الجلوس المخصص:</span>
              </div>
              <span className="text-xs font-extrabold text-amber-100 gold-gradient-bg text-slate-950 px-2.5 py-0.5 rounded-lg">
                {tableNumber}
              </span>
            </div>
          )}
        </div>

        {/* High-Resolution QR Code */}
        <div className="bg-white rounded-2xl p-5 my-3 flex flex-col items-center justify-center shadow-inner border border-amber-300/40 relative">
          <div className="p-2 bg-white rounded-xl">
            <QRCodeSVG
              value={passToken}
              size={185}
              level="H"
              includeMargin={false}
              fgColor="#0F172A"
              bgColor="#FFFFFF"
            />
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-slate-800 text-xs font-bold bg-amber-50 px-3 py-1 rounded-full border border-amber-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>رمز مشفر ومعتمد للبوابة</span>
          </div>
        </div>

        {/* Women Section Etiquette Reminder */}
        {isWomenSection && (
          <div className="bg-pink-950/40 border border-pink-500/30 rounded-xl p-2.5 text-center text-[11px] text-pink-200 space-y-0.5 mb-2">
            <div className="flex items-center justify-center gap-1.5 font-bold text-pink-300">
              <CameraOff className="w-3.5 h-3.5" />
              <span>ممنوع التصوير منعاً باتاً • جنة الأطفال منازلهم 👶</span>
            </div>
            <p className="text-[10px] text-pink-300/80">يرجى إبراز هذا الرمز عند مدخل الاستقبال لموظفة البوابة.</p>
          </div>
        )}

        <div className="text-center pt-1 text-[11px] text-amber-200/70 leading-relaxed">
          <p>يرجى إبراز هذا الرمز عند البوابة لموظف الاستقبال لمرة واحدة.</p>
        </div>
      </div>

      {/* Main Buttons */}
      <div className="space-y-2.5">
        <button
          onClick={handleSaveImage}
          disabled={downloading}
          className="w-full py-4 px-4 rounded-2xl gold-gradient-bg text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
        >
          {downloading ? (
            <span>جاري تجهيز وحفظ البطاقة...</span>
          ) : savedSuccess ? (
            <>
              <Check className="w-5 h-5 text-emerald-950" />
              <span>تم حفظ البطاقة بنجاح</span>
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              <span>حفظ بطاقة الدخول في الصور (PNG)</span>
            </>
          )}
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => setIsCalendarModalOpen(true)}
            className="flex-1 py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <CalendarPlus className="w-4 h-4 text-amber-400" />
            <span>إضافة تذكير للتقويم</span>
          </button>

          {venueMapsUrl && (
            <a
              href={venueMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <MapPin className="w-4 h-4 text-amber-400" />
              <span>موقع القاعة</span>
            </a>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 pt-1">
          💡 يمكنك أيضاً الضغط مطولاً على الصورة لحفظها مباشرة في ألبوم الجوال.
        </p>
      </div>

      {/* Calendar Selection Modal */}
      {isCalendarModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-right">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <CalendarPlus className="w-4 h-4 text-amber-400" />
              <span>إضافة موعد الزواج إلى تقويم هاتفك</span>
            </h3>
            <p className="text-xs text-slate-400">
              اختر نوع التقويم المستخدم في جوالك لتلقي تنبيهات تذكيرية تلقائية قبل الحفل:
            </p>

            <div className="space-y-2 pt-2">
              <a
                href={googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsCalendarModalOpen(false)}
                className="w-full py-3 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-100 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                    G
                  </div>
                  <span>تقويم Google (Google Calendar)</span>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-500" />
              </a>

              <a
                href={appleCalendarUrl}
                download="wedding-invitation.ics"
                onClick={() => setIsCalendarModalOpen(false)}
                className="w-full py-3 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-100 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">
                    🍎
                  </div>
                  <span>تقويم Apple والآيفون (.ics)</span>
                </div>
                <Download className="w-4 h-4 text-slate-500" />
              </a>
            </div>

            <div className="pt-2 border-t border-slate-800 text-center">
              <button
                onClick={() => setIsCalendarModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
