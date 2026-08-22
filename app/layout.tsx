import type { Metadata } from 'next';
import './globals.css';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#0F172A" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;600;700;800;900&family=Amiri:ital,wght@0,400;0,700;1,400&family=Aref+Ruqaa:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-amber-500/30 selection:text-amber-200 font-sans"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
