"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="aurora-bg-drift min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div 
        className="max-w-sm w-full backdrop-blur-[20px] bg-[var(--surface-card)]/80 frosted-glass border border-[var(--border-card)] shadow-2xl relative z-10 flex flex-col items-center" 
        style={{ borderRadius: 'var(--radius-xl)', padding: '40px 32px' }}
      >
        <div className="w-16 h-16 rounded-full bg-[var(--surface-subtle)] flex items-center justify-center mb-6">
          <WifiOff className="w-8 h-8 text-[#71717a]" />
        </div>
        <h1 className="text-3xl font-black tracking-tight aurora-text mb-2">You're offline</h1>
        <p className="text-[var(--color-text-secondary)] text-[#a1a1aa] mb-8 font-medium">Check your connection and try again.</p>
        
        <button 
          onClick={() => window.location.reload()}
          className="w-full text-white font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center"
          style={{ background: 'var(--aurora-primary)', borderRadius: 'var(--radius-md)', padding: '14px 24px' }}
        >
          Try again
        </button>
        
        <p className="text-[11px] text-[#a1a1aa] font-medium mt-6 text-center w-full">
          Your previously viewed runs may still be available.
        </p>
      </div>
    </div>
  );
}
