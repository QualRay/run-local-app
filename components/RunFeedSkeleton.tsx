import React from "react";

export default function RunFeedSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((key) => (
        <div 
          key={key}
          className="bg-white rounded-[2rem] p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.05)] border border-slate-100"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-full">
              {/* Title Placeholder */}
              <div className="h-6 w-[60%] bg-slate-200 animate-pulse rounded mb-2"></div>
              {/* Location Line Placeholder */}
              <div className="h-4 w-[40%] bg-slate-200 animate-pulse rounded mb-2"></div>
              {/* Distance Away Badge Placeholder */}
              <div className="h-4 w-24 bg-slate-200 animate-pulse rounded"></div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-5">
            {/* Date Placeholder */}
            <div className="h-4 w-[90%] bg-slate-200 animate-pulse rounded"></div>
            {/* Participants Placeholder */}
            <div className="h-4 w-[70%] bg-slate-200 animate-pulse rounded"></div>
          </div>

          {/* Button Placeholder */}
          <div className="w-full h-12 bg-slate-200 animate-pulse rounded-xl"></div>
        </div>
      ))}
    </div>
  );
}
