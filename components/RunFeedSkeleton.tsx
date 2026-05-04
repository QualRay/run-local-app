import React from "react";

export default function RunFeedSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((key) => (
        <div 
          key={key}
          className="bg-[var(--surface-card)] p-5 border border-[var(--border-card)]"
          style={{ borderRadius: 'var(--radius-lg)', minHeight: 176 }}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-full">
              {/* Title Placeholder */}
              <div className="h-6 w-[60%] bg-[var(--surface-subtle)] animate-pulse rounded mb-2"></div>
              {/* Location Line Placeholder */}
              <div className="h-4 w-[40%] bg-[var(--surface-subtle)] animate-pulse rounded mb-2"></div>
              {/* Distance Away Badge Placeholder */}
              <div className="h-4 w-24 bg-[var(--surface-subtle)] animate-pulse rounded"></div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-5">
            {/* Date Placeholder */}
            <div className="h-4 w-[90%] bg-[var(--surface-subtle)] animate-pulse rounded"></div>
            {/* Participants Placeholder */}
            <div className="h-4 w-[70%] bg-[var(--surface-subtle)] animate-pulse rounded"></div>
          </div>

          {/* Button Placeholder */}
          <div className="w-full h-12 bg-[var(--surface-subtle)] animate-pulse rounded-xl"></div>
        </div>
      ))}
    </div>
  );
}
