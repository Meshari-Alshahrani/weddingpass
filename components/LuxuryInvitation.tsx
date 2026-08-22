'use client';

import React, { useState, useEffect } from 'react';
import { Party, WeddingEvent, EntryPass } from '@/types/database';
import { EntryPassCard } from './EntryPassCard';
import confetti from 'canvas-confetti';
import {
  Calendar,
  Clock,
  MapPin,
  Heart,
  Sparkles,
  Check,
  X,
  UserCheck,
  Navigation,
  CalendarPlus,
  Home,
  Image as ImageIcon,
} from 'lucide-react';
import Link from 'next/link';

interface LuxuryInvitationProps {
  party: Party;
  event: WeddingEvent;
  initialEntryPass?: EntryPass;
  invitationToken: string;
}

export function LuxuryInvitation({
  party,
  event,
  initialEntryPass,
  invitationToken,
}: LuxuryInvitationProps) {
  const [mounted, setMounted] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<'unopened' | 'viewed' | 'confirmed' | 'declined'>(party.rsvp_status);
  const [attendingChoice, setAttendingChoice] = useState<'yes' | 'no' | null>(
    party.rsvp_status === 'confirmed' ? 'yes' : party.rsvp_status === 'declined' ? 'no' : null
  );
  const [selectedCount, setSelectedCount] = useState<number>(
    party.confirmed_count > 0 ? party.confirmed_count : party.allowed_count
  );
  const [notes, setNotes] = useState<string>(party.notes || '');
  const [entryPass, setEntryPass] = useState<EntryPass | undefined>(initialEntryPass);
  const [loading, setLoading] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    setMounted(true);
    const targetDate = new Date(`${event.event_date}T${event.event_time}`);
    const updateCountdown = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [event.event_date, event.event_time]);

  const handleRSVPSubmit = async () => {
    if (!attendingChoice) return;
    setLoading(true);
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: invitationToken,
          status: attendingChoice === 'yes' ? 'confirmed' : 'declined',
          attendingCount: attendingChoice === 'yes' ? selectedCount : 0,
          notes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRsvpStatus(attendingChoice === 'yes' ? 'confirmed' : 'declined');
        setSubmittedMessage(data.message);
        if (data.entryPass) {
          setEntryPass(data.entryPass);
        }

        if (attendingChoice === 'yes') {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#D4AF37', '#F3E5AB', '#ffffff', '#10B981'],
          });
        }
      }
    } catch (err) {
      console.error('Error submitting RSVP:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCalendar = () => {
    const title = `حفل زفاف ${event.groom_name} و ${event.bride_name}`;
    const description = `يشرفنا حضوركم لحفل زفافنا في ${event.venue_name}`;
    const location = event.venue_name;
    const startStr = `${event.event_date.replace(/-/g, '')}T${event.event_time.replace(/:/g, '')}Z`;
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
    link.download = 'wedding-invitation.ics';
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center py-8 px-4 sm:px-6">
      {/* Background Decorative Gold Light Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-amber-600/5 rounded-full blur-3xl" />
      </div>

      <main className="w-full max-w-xl relative z-10 space-y-6">
        {/* Top Mini Brand Link */}
        <div className="flex justify-between items-center px-2">
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>WeddingPass</span>
          </Link>
          <span className="text-[11px] text-amber-300/70 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
            دعوة خاصة
          </span>
        </div>

        {/* Main Luxury Invitation Card */}
        <div className="rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-amber-500/30 p-6 sm:p-10 shadow-[0_0_50px_-15px_rgba(212,175,55,0.2)] text-center relative overflow-hidden">
          {/* Top Decorative Border Arch */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent rounded-full" />
          </div>

          {/* Welcome Bismillah & Verse */}
          <div className="space-y-3 mb-8">
            <p className="text-sm font-serif text-amber-300/80">بِسْمِ اللَّـهِ الرَّحْمَـٰنِ الرَّحِيمِ</p>
            {event.welcome_verse && (
              <p className="text-xs sm:text-sm text-amber-200/70 font-serif leading-relaxed px-4">
                &ldquo;{event.welcome_verse}&rdquo;
              </p>
            )}
          </div>

          {/* Invitation Target Person Header */}
          <div className="my-6 inline-block px-5 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm font-semibold">
            دعوة خاصة لكريمة / لكريم: <span className="text-amber-100 font-bold">{party.party_name}</span>
          </div>

          {/* Custom Card Image (If provided) */}
          {event.invitation_image_url ? (
            <div className="my-6 rounded-2xl overflow-hidden border border-amber-500/30 shadow-2xl">
              <img
                src={event.invitation_image_url}
                alt="بطاقة الدعوة"
                className="w-full h-auto object-cover max-h-[450px]"
              />
            </div>
          ) : (
            /* Groom & Bride Names Gold Typography */
            <div className="my-8 space-y-3">
              <p className="text-xs uppercase tracking-widest text-amber-400/70 font-semibold">
                نتشرف بدعوتكم لحفل زفاف
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 my-2">
                <h1 className="text-2xl sm:text-3xl font-bold font-serif gold-gradient-text">
                  {event.groom_name}
                </h1>
                <Heart className="w-6 h-6 text-amber-400 fill-amber-400/20 animate-pulse hidden sm:block" />
                <h1 className="text-2xl sm:text-3xl font-bold font-serif gold-gradient-text">
                  {event.bride_name}
                </h1>
              </div>
              <p className="text-xs text-amber-200/60 font-serif">
                وذلك بمشيئة الله تعالى وتوفيقه
              </p>
            </div>
          )}

          {/* Event Date & Time Cards */}
          <div className="grid grid-cols-2 gap-3 my-6 text-right">
            <div className="bg-slate-950/70 p-4 rounded-2xl border border-amber-500/20 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-amber-300/60">تاريخ الحفل</p>
                <p className="text-sm font-bold text-amber-100 mt-0.5">{event.event_date}</p>
              </div>
            </div>

            <div className="bg-slate-950/70 p-4 rounded-2xl border border-amber-500/20 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-amber-300/60">الوقت</p>
                <p className="text-sm font-bold text-amber-100 mt-0.5">{event.event_time.slice(0, 5)} مساءً</p>
              </div>
            </div>
          </div>

          {/* Venue & Location */}
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-amber-500/20 text-right space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-amber-300/60">مكان الحفل</p>
                <p className="text-sm font-bold text-amber-100 mt-0.5">{event.venue_name}</p>
                {event.venue_address && (
                  <p className="text-xs text-amber-200/60 mt-1">{event.venue_address}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-amber-500/10">
              {event.venue_maps_url && (
                <a
                  href={event.venue_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>الموقع على الخريطة</span>
                </a>
              )}
              <button
                onClick={handleAddToCalendar}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>إضافة للتقويم</span>
              </button>
            </div>
          </div>

          {/* Live Countdown */}
          {mounted && (
            <div className="my-6 pt-4 border-t border-amber-500/20">
              <p className="text-xs text-amber-300/70 mb-3 font-semibold">المتبقي على موعد الحفل</p>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/20">
                  <span className="text-lg font-bold text-amber-200">{timeLeft.days}</span>
                  <span className="block text-[10px] text-amber-300/60 mt-0.5">يوم</span>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/20">
                  <span className="text-lg font-bold text-amber-200">{timeLeft.hours}</span>
                  <span className="block text-[10px] text-amber-300/60 mt-0.5">ساعة</span>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/20">
                  <span className="text-lg font-bold text-amber-200">{timeLeft.minutes}</span>
                  <span className="block text-[10px] text-amber-300/60 mt-0.5">دقيقة</span>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/20">
                  <span className="text-lg font-bold text-amber-200">{timeLeft.seconds}</span>
                  <span className="block text-[10px] text-amber-300/60 mt-0.5">ثانية</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RSVP Interactive Section */}
        <div className="rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-amber-500/30 p-6 sm:p-8 shadow-xl text-right space-y-6">
          <div className="border-b border-amber-500/20 pb-4 text-center">
            <h2 className="text-lg font-bold text-amber-100 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>تأكيد الحضور (RSVP)</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </h2>
            <p className="text-xs text-amber-200/70 mt-1">
              يسعدنا مشاركتكم لنا هذه الليلة المباركة، يرجى تأكيد حضوركم لتجهيز الاستقبال.
            </p>
          </div>

          {/* Question 1: Will you honor us with your attendance? */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-amber-300/80 block">
              هل ستشرفنا بحضوركم الكريم؟
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAttendingChoice('yes')}
                className={`py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  attendingChoice === 'yes'
                    ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/40'
                    : 'bg-slate-950/60 border-slate-700/60 text-slate-300 hover:border-amber-500/40'
                }`}
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>بكل سرور، سأحضر</span>
              </button>

              <button
                type="button"
                onClick={() => setAttendingChoice('no')}
                className={`py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  attendingChoice === 'no'
                    ? 'bg-rose-950/40 border-rose-500 text-rose-200 ring-2 ring-rose-500/40'
                    : 'bg-slate-950/60 border-slate-700/60 text-slate-300 hover:border-amber-500/40'
                }`}
              >
                <X className="w-4 h-4 text-rose-400" />
                <span>أعتذر عن الحضور</span>
              </button>
            </div>
          </div>

          {/* Question 2 (Conditional): How many people will attend from this party? */}
          {attendingChoice === 'yes' && (
            <div className="space-y-3 pt-4 border-t border-amber-500/10 animate-fadeIn">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-amber-300/80">
                  كم شخصاً سيحضر من هذه الدعوة؟
                </label>
                <span className="text-[11px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  الحد الأقصى: {party.allowed_count} {party.allowed_count === 1 ? 'شخص' : 'أشخاص'}
                </span>
              </div>

              {/* Number Selectors */}
              <div className="flex items-center gap-2 flex-wrap">
                {Array.from({ length: party.allowed_count }, (_, i) => i + 1).map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSelectedCount(num)}
                    className={`flex-1 min-w-[50px] py-3 rounded-xl font-bold text-sm border transition-all cursor-pointer flex flex-col items-center justify-center ${
                      selectedCount === num
                        ? 'gold-gradient-bg text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 scale-105'
                        : 'bg-slate-950/60 border-slate-700/70 text-amber-200 hover:border-amber-500/40'
                    }`}
                  >
                    <span>{num}</span>
                    <span className="text-[10px] font-normal opacity-80">
                      {num === 1 ? 'شخص' : 'أشخاص'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional Notes / Congratulations */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-semibold text-amber-300/80 block">
              رسالة أو تهنئة للعروسين (اختياري)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="بارك الله لهما وبارك عليهما وجمع بينهما في خير..."
              rows={2}
              className="w-full bg-slate-950/70 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          {/* Confirm Button */}
          <button
            onClick={handleRSVPSubmit}
            disabled={!attendingChoice || loading}
            className={`w-full py-4 px-6 rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
              attendingChoice && !loading
                ? 'gold-gradient-bg text-slate-950 hover:brightness-110 active:scale-[0.99] shadow-amber-500/20'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <span>جاري الحفظ...</span>
            ) : (
              <>
                <UserCheck className="w-5 h-5" />
                <span>حفظ تأكيد الحضور</span>
              </>
            )}
          </button>

          {submittedMessage && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-center text-xs text-emerald-300 font-semibold animate-fadeIn">
              {submittedMessage}
            </div>
          )}
        </div>

        {/* Independent Entry Pass Card (Shows ONLY after RSVP is confirmed) */}
        {rsvpStatus === 'confirmed' && (entryPass || initialEntryPass) && (
          <div className="space-y-3 animate-fadeIn pt-4">
            <div className="text-center">
              <span className="text-xs text-amber-300/80 font-bold bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
                ✨ تم تأكيد حضوركم وتوليد بطاقة الدخول
              </span>
            </div>
            <EntryPassCard
              partyName={party.party_name}
              confirmedCount={selectedCount}
              section={party.section}
              passToken={entryPass?.raw_pass_token || initialEntryPass?.raw_pass_token || `wp_pass_${party.id}`}
              eventGroom={event.groom_name}
              eventBride={event.bride_name}
              eventDate={event.event_date}
              eventTime={event.event_time}
              venueName={event.venue_name}
            />
          </div>
        )}
      </main>
    </div>
  );
}
