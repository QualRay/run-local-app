import "./globals.css";
import { Toaster } from "sonner";
import AnimationShell from "@/components/AnimationShell";

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
    <html lang="en">
      <body className="antialiased bg-background text-foreground min-h-screen">
        <main className="max-w-md mx-auto min-h-screen border-x border-gray-100 dark:border-gray-800 shadow-sm relative">
          <AnimationShell>
            {children}
          </AnimationShell>
          <Toaster position="top-center" richColors />
        </main>
      </body>
    </html>
  );
}
