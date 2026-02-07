import type { Metadata } from 'next';
import { Instrument_Sans, Inter } from 'next/font/google';
import './globals.css';
import Navigation from '@/components/Navigation';

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
});

const geist = Inter({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MealMind - AI-Powered Family Meal Planning',
  description:
    'Eliminate daily meal decision fatigue with AI-generated personalized meal plans, smart recipe management, and intelligent shopping lists.',
  keywords: ['meal planning', 'AI', 'recipes', 'family meals', 'shopping list'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${instrumentSans.variable} ${geist.variable} font-sans`}>
        <div className="min-h-screen bg-background">
          <Navigation />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
