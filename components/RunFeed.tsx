"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { MapPin, Users, Calendar, ArrowRight, Loader2, Plus, Map } from "lucide-react";
import Link from "next/link";
import RunFeedSkeleton from "./RunFeedSkeleton";
import { motion } from "framer-motion";

const listVariants = { visible: { transition: { staggerChildren: 0.06 } } };
const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4,0,0.2,1] } } };

export type Run = {
  id: string;
  title: string;
  start_time: string;
  distance_away_miles: number;
  participants_count: number;
  location_label: string;
};

export default function RunFeed() {
  // Config States
  const [radiusMiles, setRadiusMiles] = useState<number>(5);
  const [autoExpandedTo, setAutoExpandedTo] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  
  // Data States
  const [allRuns, setAllRuns] = useState<Run[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [locationError, setLocationError] = useState(false);

  const supabase = createClient();

  // 1. Initial Location Lock (Priority: Zip Code -> Browser GPS)
  useEffect(() => {
    async function determineLocation() {
      try {
        // Step A: Check if logged in & has saved Zip Code
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("users")
            .select("zip_code")
            .eq("id", user.id)
            .single();

          if (profile && profile.zip_code) {
            // Geocode Zip Code secretly using accurate postalcode endpoint
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&postalcode=${encodeURIComponent(profile.zip_code)}&countrycodes=us`);
            const geocodeData = await res.json();
            
            if (geocodeData && geocodeData.length > 0) {
              setCoords({
                lat: parseFloat(geocodeData[0].lat),
                lon: parseFloat(geocodeData[0].lon),
              });
              return; // Success! Skip browser GPS completely
            }
          }
        }
      } catch (err) {
        console.warn("Zip code geocoding failed, falling back to browser...");
      }

      // Step B: Fallback to chaotic Browser GPS
      if (!navigator.geolocation) {
        setLocationError(true);
        setLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => setCoords({ lat: position.coords.latitude, lon: position.coords.longitude }),
        (error) => {
          console.error("Location error:", error);
          setLocationError(true);
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    determineLocation();
  }, [supabase]);

  // 2. Fetch Runs ONCE when Location is determined
  useEffect(() => {
    if (!coords) return;

    async function fetchRuns() {
      // Show subtle refetch layer without destroying the whole feed
      if (!loading) setRefetching(true);

      // We implement frontend filtering as a robust fallback to missing RPCs
      const { data, error } = await supabase
        .from("runs")
        .select("*, run_participants(count)")
        .gte("start_time", new Date().toISOString());

      if (error) {
        console.error("Error fetching runs:", error);
        setAllRuns([]);
      } else if (data) {
        // Parse EWKB Location (0101000020E6100000...) and calculate Haversine distance
        const parseLocation = (hexStr: string) => {
          if (!hexStr || !hexStr.startsWith('0101000020E6100000')) return null;
          const xHex = hexStr.substring(18, 34);
          const yHex = hexStr.substring(34, 50);
          const parseLE64 = (hex: string) => {
            const buf = new ArrayBuffer(8);
            const view = new DataView(buf);
            for (let i = 0; i < 8; i++) {
              view.setUint8(i, parseInt(hex.substring(i * 2, i * 2 + 2), 16));
            }
            return view.getFloat64(0, true);
          };
          return { lon: parseLE64(xHex), lat: parseLE64(yHex) };
        };

        const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 3958.8; // miles
          const dLat = (lat2 - lat1) * (Math.PI / 180);
          const dLon = (lon2 - lon1) * (Math.PI / 180);
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        };

        const processedRuns = data
          .map((run: any) => {
            const loc = parseLocation(run.location);
            let dist = 9999;
            if (loc && coords) {
              dist = haversineDistance(coords.lat, coords.lon, loc.lat, loc.lon);
            }
            return {
              id: run.id,
              title: run.title,
              start_time: run.start_time,
              distance_away_miles: dist,
              participants_count: run.run_participants?.[0]?.count || 0,
              location_label: run.location_label,
            };
          })
          .sort((a, b) => a.distance_away_miles - b.distance_away_miles); // Sort by closest!

        // SMART RADIUS EXPANSION
        let currentRadius = 5;
        let runsFound = processedRuns.some(r => r.distance_away_miles <= currentRadius);
        
        if (!runsFound) {
          for (const step of [10, 15, 20]) {
             if (processedRuns.some(r => r.distance_away_miles <= step)) {
                currentRadius = step;
                setAutoExpandedTo(step);
                runsFound = true;
                break;
             }
          }
        }
        
        setRadiusMiles(currentRadius);
        setAllRuns(processedRuns);
      } else {
        setAllRuns([]);
      }
      
      setLoading(false);
      setRefetching(false);
    }

    fetchRuns();
  }, [coords, supabase]);

  // 3. Reactively filter displayed runs when slider moves (No DB calls)
  useEffect(() => {
    setRuns(allRuns.filter((run) => run.distance_away_miles <= radiusMiles));
  }, [allRuns, radiusMiles]);

  // Loading Initial State
  if (loading && !coords && !locationError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#71717a] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm font-medium">Finding your coordinates...</p>
      </div>
    );
  }

  // Location Denied / Error
  if (locationError) {
    return (
      <div className="bg-orange-50 border border-orange-100 p-6 rounded-2xl flex flex-col items-center text-center">
        <MapPin className="w-8 h-8 text-orange-400 mb-3" />
        <h3 className="font-bold text-orange-900 mb-1">Location Access Needed</h3>
        <p className="text-sm text-orange-700 mb-4 leading-relaxed">
          We need your location to find the best runs nearby. Please enable location services in your browser.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Search Radius Controller */}
      <div className="bg-[var(--surface-card)] rounded-[2rem] p-6 shadow-sm border border-[var(--border-card)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 opacity-[0.03] dark:opacity-5 transition-opacity group-hover:opacity-[0.06] dark:group-hover:opacity-10 pointer-events-none">
           <Map className="w-32 h-32 -mt-10 -mr-10 text-[#8b5cf6]" />
        </div>
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
            <label className="text-sm font-bold text-[var(--foreground)] uppercase tracking-widest flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#8b5cf6]" />
              Search Radius
            </label>
            <div className="relative group/tooltip">
              <span className="font-bold px-4 py-1.5 rounded-xl text-sm transition-all shadow-sm aurora-text bg-[var(--surface-subtle)] border border-[var(--border-card)] flex items-center justify-center min-w-[90px]">
                {radiusMiles} miles
              </span>
            </div>
          </div>
          
          <div className="relative w-full flex items-center h-4 mt-2 mb-1">
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={radiusMiles}
              onChange={(e) => {
                setRadiusMiles(parseInt(e.target.value));
                setAutoExpandedTo(null); // Clear message if user manually changes slider
              }}
              className="absolute top-1/2 -translate-y-1/2 w-full h-2 rounded-full appearance-none cursor-pointer focus:outline-none
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                         [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(139,92,246,0.5)] [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-[#8b5cf6]
                         [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:active:scale-110 [&::-webkit-slider-thumb]:active:cursor-grabbing
                         [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 
                         [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white
                         [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(139,92,246,0.5)] [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-[#8b5cf6]
                         [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:active:scale-110"
              style={{
                background: `linear-gradient(to right, #8b5cf6 ${(radiusMiles - 1) / 19 * 100}%, var(--surface-subtle) ${(radiusMiles - 1) / 19 * 100}%)`
              }}
            />
          </div>
          <div className="flex justify-between text-[11px] uppercase tracking-wider text-[#71717a] dark:text-[#a1a1aa] mt-4 font-bold px-1">
            <span>1 mi</span>
            <span>20 mi</span>
          </div>
        </div>
      </div>

      {/* Auto Expansion Message */}
      {autoExpandedTo && runs.length > 0 && (
         <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 mb-4 shadow-sm">
            <Map className="w-5 h-5 shrink-0 text-indigo-500" />
            <p>No runs within 5 miles. Automatically showing results within {autoExpandedTo} miles.</p>
         </div>
      )}

      {loading && coords ? (
        // Secondary skeleton loader while fetching first batch of runs
        <RunFeedSkeleton />
      ) : runs.length === 0 ? (
        // Empty State
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-[var(--surface-card)] rounded-3xl border border-dashed border-[var(--border-card)] text-center transition-all">
          <div className="w-16 h-16 bg-[var(--surface-subtle)] rounded-full flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-[#71717a]" />
          </div>
          <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">No runs near you</h3>
          <p className="text-sm text-[#71717a] mb-6 max-w-[200px] leading-relaxed">
            Expand your radius or step up to be the first host.
          </p>
          <Link href="/create" className="text-white font-semibold flex items-center gap-2 px-6 py-3.5 rounded-2xl transition-all active:scale-[0.98]" style={{ background: 'var(--aurora-primary)' }}>
            <Plus className="w-5 h-5" />
            Create First Run
          </Link>
        </div>
      ) : (
        // Runs Wrapper (with subtle opacity drop when refetching slider checks)
        <motion.div 
          className={`space-y-4 transition-opacity duration-300 ${refetching ? 'opacity-50 blur-[1px]' : 'opacity-100'}`}
          variants={listVariants}
          initial="hidden"
          animate="visible"
        >
          {runs.map((run) => {
            const runDate = new Date(run.start_time);
            const timeFormatted = runDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateFormatted = runDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

            return (
              <motion.div 
                key={run.id}
                variants={cardVariants}
                className="bg-[var(--surface-card)] border border-[var(--border-card)] p-5 transition-transform active:scale-[0.99]"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-[var(--foreground)] text-lg leading-tight mb-1">{run.title}</h3>
                    <div className="flex items-center text-[#71717a] mb-1 text-sm font-medium">
                      <MapPin className="w-4 h-4 mr-1.5 shrink-0" />
                      <span className="truncate">{run.location_label || "Starting Point"}</span>
                    </div>
                    <p className="font-semibold mt-1">
                      <span style={{ background: 'var(--aurora-subtle)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', fontSize: 12 }}>
                        {run.distance_away_miles.toFixed(1)} miles away
                      </span>
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm text-[#71717a] mb-5">
                  <div className="flex items-center gap-2 font-medium">
                    <Calendar className="w-4 h-4 text-[#a1a1aa]" />
                    <span className="text-[var(--foreground)]">{dateFormatted}, {timeFormatted}</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <Users className="w-4 h-4 text-[#a1a1aa]" />
                    <span className="text-[var(--foreground)]">{run.participants_count} joined</span>
                  </div>
                </div>

                <Link href={`/run/${run.id}`} className="w-full bg-[var(--surface-subtle)] text-[var(--foreground)] focus:ring-none rounded-xl py-3.5 font-bold flex items-center justify-center gap-2 hover:opacity-80 active:scale-[0.98]" style={{ transition: 'all .15s' }}>
                  Join & Details
                  <ArrowRight className="w-4 h-4 text-[#71717a]" />
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
