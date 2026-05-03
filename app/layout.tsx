import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import "./globals.css";
import { Toaster } from "sonner";
import AnimationShell from "@/components/AnimationShell";
import SmoothScroll from "@/components/SmoothScroll";
import TabBar from "@/components/TabBar";

export const metadata = {
  title: "RunLocal - Find Runs Near You",
  description: "A hyperlocal running app to find and join runs within a 5-mile radius.",
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
        </main>
      </body>
    </html>
  );
}
