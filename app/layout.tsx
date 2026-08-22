import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WeddingPass | منصة بطاقات الدخول والدعوات الفاخرة للزواجات',
  description: 'نظام إدارة دعوات الزفاف، تأكيد الحضور (RSVP)، وإصدار بطاقات الدخول برموز QR',
  manifest: '/manifest.json',
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
          href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-amber-500/30 selection:text-amber-200"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
