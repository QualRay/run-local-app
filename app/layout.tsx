import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import "./globals.css";
import { Toaster } from "sonner";
import AnimationShell from "@/components/AnimationShell";
import SmoothScroll from "@/components/SmoothScroll";
import TabBar from "@/components/TabBar";

import type { Metadata, Viewport } from 'next';
import InstallPrompt from "@/components/InstallPrompt";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  title: "RunLocal - Find Runs Near You",
  description: "A hyperlocal running app to find and join runs within a 5-mile radius.",
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RunLocal',
  },
  formatDetection: { telephone: false },
  icons: [
    { rel: 'apple-touch-icon', url: '/apple-touch-icon.png' }
  ],
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#6366f1' },
    { media: '(prefers-color-scheme: dark)', color: '#6366f1' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased bg-background text-foreground min-h-screen">
        <main className="max-w-md mx-auto min-h-screen border-x border-gray-100 dark:border-gray-800 shadow-sm relative pb-24">
          <SmoothScroll>
            <AnimationShell>
              {children}
            </AnimationShell>
          </SmoothScroll>
          <Toaster position="top-center" richColors />
          <TabBar />
          <InstallPrompt />
          <Analytics />
          <SpeedInsights />
        </main>
      </body>
    </html>
  );
}
