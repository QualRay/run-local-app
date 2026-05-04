"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOSVariant, setIsIOSVariant] = useState(false);
  const deferredPrompt = useRef<any>(null);

  useEffect(() => {
    // Check if already dismissed
    if (localStorage.getItem('runlocal-install-dismissed')) return;

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Environment checks
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      setIsIOSVariant(true);
    }

    // Capture beforeinstallprompt for Android/Desktop
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for custom "run-joined" event
    const handleRunJoined = () => {
      if (!localStorage.getItem('runlocal-install-dismissed') && !window.matchMedia('(display-mode: standalone)').matches) {
        setShowPrompt(true);
      }
    };
    window.addEventListener('run-joined', handleRunJoined);

    // Visit count check
    const count = parseInt(localStorage.getItem('runlocal-visit-count') ?? '0') + 1;
    localStorage.setItem('runlocal-visit-count', String(count));
    if (count >= 3) {
      // Delay prompt slightly
      setTimeout(() => setShowPrompt(true), 1500);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('run-joined', handleRunJoined);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem('runlocal-install-dismissed', 'true');
    }
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('runlocal-install-dismissed', 'true');
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <div className="fixed inset-x-0 bottom-0 z-[100] pb-[env(safe-area-inset-bottom)] pointer-events-none flex justify-center">
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            className="w-full max-w-md pointer-events-auto bg-[var(--surface-card)] border-t-[0.5px] border-[var(--border-card)] shadow-2xl relative overflow-hidden"
            style={{ padding: 24 }}
          >
            {/* Thin Aurora Line */}
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'var(--aurora-primary)' }} />
            
            <h3 className="text-2xl font-black tracking-tight aurora-text mb-2">Run with us, anytime.</h3>
            <p className="text-[var(--color-text-secondary)] text-sm mb-6 font-medium text-[#71717a]">
              Add RunLocal to your home screen for instant access to nearby runs.
            </p>

            {isIOSVariant && !deferredPrompt.current ? (
              <div className="bg-[var(--surface-subtle)] p-4 rounded-xl text-sm text-[#71717a] font-medium mb-4 flex items-center justify-center gap-2 border border-[var(--border-card)]">
                Tap <span className="text-xl">⎗</span> then "Add to Home Screen"
              </div>
            ) : (
              <button
                onClick={handleInstall}
                className="w-full text-white font-bold transition-transform active:scale-[0.98] mb-3 flex justify-center items-center"
                style={{ background: 'var(--aurora-primary)', borderRadius: 'var(--radius-md)', padding: '14px 24px' }}
              >
                Add to home screen
              </button>
            )}

            <button
              onClick={handleDismiss}
              className="w-full text-[#a1a1aa] font-bold text-sm hover:text-[var(--foreground)] transition-colors py-2"
            >
              Not now
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
