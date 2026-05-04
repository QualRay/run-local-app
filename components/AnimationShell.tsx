"use client";

import { AnimatePresence } from "framer-motion";
import { useWebVitals } from "@/hooks/useWebVitals";

export default function AnimationShell({ children }: { children: React.ReactNode }) {
  useWebVitals();
  return (
    <AnimatePresence mode="wait">
      {children}
    </AnimatePresence>
  );
}
