'use client';

import React, { useState, useRef } from 'react';
import type { PublicEvent, PublicMoment } from '@/lib/presentation/publicDtos';
import {
  Camera,
  Upload,
  Sparkles,
  Heart,
  Home,
  Check,
  Plus,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';
import Link from 'next/link';

interface MomentsGalleryProps {
  initialEvent: PublicEvent;
  initialMoments: PublicMoment[];
}

export function MomentsGallery({ initialEvent, initialMoments }: MomentsGalleryProps) {
  const [moments, setMoments] = useState<PublicMoment[]>(initialMoments);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploaderName, setUploaderName] = useState('');
  const [uploaderPhone, setUploaderPhone] = useState('');
  const [caption, setCaption] = useState('');
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compress image client-side to WebP < 1MB
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Max dimension 1600px
        const maxDim = 1600;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const webpData = canvas.toDataURL('image/webp', 0.82);
          setPreviewDataUrl(webpData);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewDataUrl || !uploaderName.trim()) return;

    setUploading(true);
    setSubmittedMessage(null);

    try {
      const res = await fetch('/api/public/moment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploaderName: uploaderName.trim(),
          uploaderPhone: uploaderPhone.trim(),
          mediaUrl: previewDataUrl,
          caption: caption.trim(),
          section: 'men',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmittedMessage('تم استلام صورتك الكريمة بنجاح! سيتم نشرها في الألبوم بعد مراجعة سريعة من العريس 🌹');
        setPreviewDataUrl(null);
        setCaption('');
        setTimeout(() => {
          setIsUploadOpen(false);
          setSubmittedMessage(null);
        }, 3000);
      }
    } catch (err) {
      console.error('Upload moment error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 space-y-8 flex flex-col items-center">
      {/* Decorative Lights */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-amber-600/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-4xl space-y-6 relative z-10">
        {/* Top Header */}
        <header className="flex justify-between items-center pb-4 border-b border-slate-800">
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>الرئيسية</span>
          </Link>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-400 mb-0.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ألبوم لقطات الحفل • LIVE MOMENTS</span>
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-serif gold-gradient-text">
              حفل زفاف {initialEvent.groom_name} & {initialEvent.bride_name}
            </h1>
          </div>

          <button
            onClick={() => setIsUploadOpen(true)}
            className="py-2 px-4 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md hover:brightness-110 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>إضافة صورة للحفل</span>
          </button>
        </header>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {moments.length === 0 && (
            <div className="col-span-3 text-center py-20 bg-slate-900/60 rounded-3xl border border-slate-800 p-8 space-y-3">
              <Camera className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-200">كن أول من يشارك لقطات الحفل!</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                التقط صور العرضة النجدية ولقطات الترحيب وشاركها مع العريس لتوثيق الليلة المباركة.
              </p>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="py-2 px-5 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold cursor-pointer"
              >
                رفع صورة الآن
              </button>
            </div>
          )}

          {moments.map((m) => (
            <div
              key={m.id}
              className="group rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-lg space-y-2 pb-3 transition-all hover:border-amber-500/40"
            >
              <div className="aspect-[4/3] overflow-hidden bg-slate-950">
                <img
                  src={m.media_url}
                  alt={m.caption || 'صورة من الحفل'}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              <div className="px-3 pt-1 text-right">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-amber-200">{m.uploader_name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(m.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {m.caption && <p className="text-xs text-slate-300 mt-1 leading-relaxed">{m.caption}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload Image Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-right">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-400" />
              <span>مشاركة صورة في ألبوم الحفل (قسم الرجال)</span>
            </h3>

            <form onSubmit={handleUploadSubmit} className="space-y-3.5 text-xs">
              {/* Image Picker */}
              <div className="border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-2xl p-4 text-center space-y-2 bg-slate-950/60">
                {previewDataUrl ? (
                  <div className="relative rounded-xl overflow-hidden aspect-video border border-slate-700">
                    <img src={previewDataUrl} alt="معاينة" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPreviewDataUrl(null)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-slate-950/80 text-rose-400 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="w-8 h-8 text-amber-400 mx-auto" />
                    <p className="text-slate-300">التقط صورة بالكاميرا أو اختر من الاستديو</p>
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      id="moment-file-input"
                    />
                    <label
                      htmlFor="moment-file-input"
                      className="inline-block py-2 px-4 rounded-xl gold-gradient-bg text-slate-950 font-bold cursor-pointer hover:brightness-110"
                    >
                      اختيار صورة
                    </label>
                  </>
                )}
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">اسمك الكريم *</label>
                <input
                  type="text"
                  required
                  value={uploaderName}
                  onChange={(e) => setUploaderName(e.target.value)}
                  placeholder="مثال: فيصل العتيبي"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">كلمة أو تعليق على الصورة (اختياري)</label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="مثال: لقطة مع العريس في صالة الاستقبال 🌹"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              {submittedMessage && (
                <div className="p-3 bg-emerald-950/70 border border-emerald-500/40 rounded-xl text-emerald-300 text-center font-semibold animate-fadeIn">
                  {submittedMessage}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={uploading || !previewDataUrl || !uploaderName.trim()}
                  className="py-2.5 px-5 rounded-xl gold-gradient-bg text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الرفع...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>إرسال الصورة</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
