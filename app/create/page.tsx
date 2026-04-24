"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Route, Clock, MapPin, Gauge, Type, AlertCircle } from "lucide-react";

export default function CreateRunPage() {
  const router = useRouter();
  const supabase = createClient();

  // Auth Protection Array
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
      }
    });
  }, [supabase, router]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [distance, setDistance] = useState("3.1"); // Set default 5k distance
  const [unit, setUnit] = useState<"mi" | "km">("mi");
  const [pace, setPace] = useState("Easy");
  
  // Location State
  const [place, setPlace] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lon: number, display_name: string} | null>(null);

  // Live Location Autocomplete
  useEffect(() => {
    // If empty or already selected, don't search
    if (!place.trim() || selectedLocation?.display_name === place) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let zipBias = '';
        if (user) {
           const { data: profile } = await supabase.from('users').select('zip_code').eq('id', user.id).single();
           if (profile?.zip_code) zipBias = ` ${profile.zip_code}`;
        }
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place + zipBias)}&countrycodes=us&limit=5`);
        const data = await res.json();
        setSuggestions(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [place, selectedLocation, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validation
    if (!title.trim()) return setError("Please enter a title.");
    if (!startDate || !startTime) return setError("Please select a valid date and time.");
    const numericDistance = parseFloat(distance.replace(/[^\d.]/g, ''));
    if (!distance || isNaN(numericDistance) || numericDistance <= 0) {
      return setError("Please enter a valid numeric distance.");
    }
    const finalDistanceMiles = unit === "km" ? numericDistance * 0.621371 : numericDistance;
    if (!place.trim()) return setError("Please enter a meeting place.");

    // Unify Date and Time accurately
    const eventDate = new Date(`${startDate}T${startTime}:00`);
    if (eventDate <= new Date()) return setError("Run time must be in the future.");

    setLoading(true);

    try {
      // 1. Get authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("You must be logged in to create a run.");
      }

      // 2. Use the exact GPS coordinates they selected from the autocomplete
      if (!selectedLocation) {
          throw new Error("Please select a specific location from the dropdown suggestions.");
      }

      const verifiedLat = selectedLocation.lat;
      const verifiedLon = selectedLocation.lon;

      // 3. Format PostGIS Location string accurately
      const locationPoint = `SRID=4326;POINT(${verifiedLon} ${verifiedLat})`;

      // 4. Insert into database
      const { error: insertError } = await supabase.from("runs").insert([
        {
          host_id: user.id,
          title: title.trim(),
          distance_miles: finalDistanceMiles,
          pace_min_mile: pace,
          start_time: eventDate.toISOString(),
          location: locationPoint,
          location_label: place.trim(), // Save the human-readable text string natively
        },
      ]);

      if (insertError) throw insertError;

      // 5. NOTIFICATION TRIGGER: New run created
      // Notify users who have notifications enabled and are in the same zip code
      const { data: profile } = await supabase.from('users').select('zip_code').eq('id', user.id).single();
      
      if (profile?.zip_code) {
        const { createNotification } = await import('@/utils/notifications');
        const { data: localUsers } = await supabase
          .from('users')
          .select('id')
          .eq('zip_code', profile.zip_code)
          .eq('notifications_enabled', true)
          .neq('id', user.id);
          
        if (localUsers) {
           for (const localUser of localUsers) {
              await createNotification(localUser.id, "new_run", `New run near you: ${title.trim()}`);
           }
        }
      }

      // Navigate back to Home feed exactly
      router.push("/");
      router.refresh();

    } catch (err: any) {
      setError(err.message || "Failed to create run.");
      setLoading(false);
    }
  };

  // Build strict 30-min interval dropdown options
  const generateTimeOptions = () => {
    const times = [];
    for (let i = 0; i < 24; i++) {
      for (const mins of ["00", "30"]) {
        const hour24 = i < 10 ? `0${i}` : `${i}`;
        const hour12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
        const ampm = i < 12 ? "AM" : "PM";
        times.push(
          <option key={`${hour24}:${mins}`} value={`${hour24}:${mins}`}>
            {hour12}:{mins} {ampm}
          </option>
        );
      }
    }
    return times;
  };

  const todayString = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="px-6 py-5 bg-white border-b border-slate-200">
        <button
          onClick={() => router.back()}
          className="text-slate-500 font-semibold text-sm hover:text-slate-800 transition"
        >
          Cancel
        </button>
      </header>

      <main className="flex-1 p-6 pb-24">
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">Create Run</h1>
          <p className="text-slate-500 text-sm">Takes less than 30 seconds.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Title */}
          <div className="relative">
            <Type className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Morning 5K Loop"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              maxLength={40}
              required
            />
          </div>

          {/* 2. Structured Date & Time Dropdowns */}
          <div className="flex gap-4">
            <div className="relative flex-[3]">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="date"
                min={todayString}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="relative flex-[2]">
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-4 text-slate-900 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                required
              >
                {generateTimeOptions()}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            {/* 3. Distance */}
            <div className="relative flex-1">
              <Route className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. 5, 10, 13.1"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-16 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as "mi" | "km")}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer transition"
              >
                <option value="mi">MI</option>
                <option value="km">KM</option>
              </select>
            </div>

            {/* 4. Pace Dropdown */}
            <div className="relative flex-1">
              <Gauge className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select
                value={pace}
                onChange={(e) => setPace(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="Easy">Easy</option>
                <option value="Tempo">Tempo</option>
                <option value="Fartlek">Fartlek</option>
                <option value="Long Run">Long Run</option>
              </select>
            </div>
          </div>

          {/* 5. Natural Text Location Place Input with Autocomplete */}
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search meeting spot (e.g. Central Park)"
              value={place}
              onChange={(e) => {
                setPlace(e.target.value);
                setSelectedLocation(null); // invalidate selection if they type
              }}
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            {isSearching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500 animate-spin" />
            )}

            {/* Suggestions Dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] overflow-hidden max-h-60 overflow-y-auto">
                {suggestions.map((s, i) => {
                  const title = s.name || s.display_name.split(',')[0];
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setPlace(title);
                        setSelectedLocation({ 
                          lat: parseFloat(s.lat), 
                          lon: parseFloat(s.lon), 
                          display_name: title 
                        });
                        setSuggestions([]);
                      }}
                      className="w-full text-left px-5 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                    >
                      <p className="font-bold text-slate-900 text-sm mb-0.5">{title}</p>
                      <p className="text-xs text-slate-500 truncate leading-tight">{s.display_name}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-xl text-sm font-medium">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black disabled:bg-slate-800 text-white font-semibold py-4 rounded-2xl shadow-lg hover:bg-slate-800 flex items-center justify-center gap-2 transition active:scale-[0.98]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Post Run to Explore Page"}
          </button>
        </form>
      </main>
    </div>
  );
}
