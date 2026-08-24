import type { Metadata, Viewport } from 'next';
import {
  Alexandria,
  Amiri,
  Aref_Ruqaa,
  IBM_Plex_Sans_Arabic,
} from 'next/font/google';
import './globals.css';

// Self-hosted at build time via next/font (no Google CDN dependency on the
// wedding day, and a simpler Hardened CSP with zero external font origins).
const alexandria = Alexandria({
  subsets: ['arabic', 'latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-alexandria',
  display: 'swap',
});

const amiri = Amiri({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-amiri',
  display: 'swap',
});

const arefRuqaa = Aref_Ruqaa({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  variable: '--font-aref-ruqaa',
  display: 'swap',
});

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'WeddingPass | منصة بطاقات الدخول والدعوات الفاخرة للزواجات',
  description: 'نظام إدارة دعوات الزفاف الملكية، تأكيد الحضور (RSVP)، وإصدار بطاقات الدخول الذكية بـ QR',
  manifest: '/manifest.json',
  openGraph: {
    title: 'WeddingPass | دعوة زفاف خاصة وملكية',
    description: 'نتشرف بدعوتكم لمشاركتنا فرحة حفل الزفاف. يرجى تأكيد حضوركم واستلام بطاقة الدخول الذكية.',
    siteName: 'WeddingPass',
    locale: 'ar_SA',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0F172A',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={`${alexandria.variable} ${amiri.variable} ${arefRuqaa.variable} ${ibmPlexSansArabic.variable}`}
    >
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-amber-500/30 selection:text-amber-200 font-sans">
        {children}
      </body>
    </html>
  );
}
