import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WEALTH RADAR // ID — Context AI & Custom Multi-Wallets',
  description: 'Aplikasi pencatat keuangan pribadi & radar net worth berbasis !y: Context AI, Supabase Realtime DB, dan Custom Multi-Wallets.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="bg-noise"></div>
        {children}
      </body>
    </html>
  );
}
