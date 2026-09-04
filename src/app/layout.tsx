import type { Metadata } from 'next';
import './globals.css';
import { MotionProvider } from '@/components/motion/MotionProvider';

/**
 * Runs before the first paint, so a visitor who chose dark never sees a
 * flash of white. Kept inline and tiny for that reason — a component
 * could not run early enough.
 */
const THEME_SCRIPT = `
try {
  var t = localStorage.getItem('theme');
  var dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
`;

export const metadata: Metadata = {
  title: 'PIEMR Internal Hackathon',
  description:
    'Internal hackathon and Smart India Hackathon pre-selection portal for Prestige Institute of Engineering Management & Research, Indore.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
