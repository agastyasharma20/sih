import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PIEMR Internal Hackathon',
  description:
    'Internal hackathon and Smart India Hackathon pre-selection portal for Prestige Institute of Engineering Management & Research, Indore.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
