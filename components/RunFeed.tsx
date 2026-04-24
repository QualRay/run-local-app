"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { MapPin, Users, Calendar, ArrowRight, Loader2, Plus, Map } from "lucide-react";
import Link from "next/link";

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
            if (loc) {
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
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
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
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5">
           <Map className="w-32 h-32 -mt-10 -mr-10 text-indigo-900" />
        </div>
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-5">
            <label className="text-sm font-bold text-slate-900 uppercase tracking-widest">Search Radius</label>
            <span className="bg-indigo-50 text-indigo-700 font-bold px-3 py-1.5 rounded-xl text-sm transition-all shadow-inner">
              {radiusMiles} miles
            </span>
          </div>
          
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
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-3 font-semibold px-0.5">
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
        <div className="flex justify-center py-10">
           <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : runs.length === 0 ? (
        // Empty State
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-white rounded-3xl border border-dashed border-slate-200 text-center transition-all">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No runs near you</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-[200px] leading-relaxed">
            Expand your radius or step up to be the first host.
          </p>
          <Link href="/create" className="bg-indigo-600 text-white font-semibold flex items-center gap-2 px-6 py-3.5 rounded-2xl hover:bg-indigo-500 transition-all active:scale-[0.98] shadow-[0_8px_30px_rgb(79,70,229,0.2)]">
            <Plus className="w-5 h-5" />
            Create First Run
          </Link>
        </div>
      ) : (
        // Runs Wrapper (with subtle opacity drop when refetching slider checks)
        <div className={`space-y-4 transition-opacity duration-300 ${refetching ? 'opacity-50 blur-[1px]' : 'opacity-100'}`}>
          {runs.map((run) => {
            const runDate = new Date(run.start_time);
            const timeFormatted = runDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateFormatted = runDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

            return (
              <div 
                key={run.id}
                className="bg-white rounded-[2rem] p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.05)] border border-slate-100 transition-transform active:scale-[0.99]"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg leading-tight mb-1">{run.title}</h3>
                    <div className="flex items-center text-slate-500 mb-1 text-sm font-medium">
                      <MapPin className="w-4 h-4 mr-1.5 shrink-0" />
                      <span className="truncate">{run.location_label || "Starting Point"}</span>
                    </div>
                    <p className="text-sm font-semibold text-indigo-600">{run.distance_away_miles.toFixed(1)} miles away</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm text-slate-600 mb-5">
                  <div className="flex items-center gap-2 font-medium">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{dateFormatted}, {timeFormatted}</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span>{run.participants_count} joined</span>
                  </div>
                </div>

                <Link href={`/run/${run.id}`} className="w-full bg-slate-50 text-slate-800 focus:ring-none rounded-xl py-3.5 font-bold flex items-center justify-center gap-2 hover:bg-slate-100 transition-all active:bg-slate-200">
                  Join & Details
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
