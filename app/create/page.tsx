"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Route, Clock, MapPin, Gauge, Type, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import PageTransition from "@/components/PageTransition";

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
  const [userLocation, setUserLocation] = useState<{lat: number, lon: number} | null>(null);
  const placeInputRef = useRef<HTMLInputElement>(null);

  // Ask for browser location to bias search results nearby
  useEffect(() => {
    if (typeof window !== 'undefined' && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => console.log("Geolocation bias skipped:", err)
      );
    }
  }, []);

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
        // Using Photon by Komoot (Free, No API Key, supports parks/POIs well)
        let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(place + zipBias)}&limit=5`;
        if (userLocation) {
          url += `&lat=${userLocation.lat}&lon=${userLocation.lon}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        setSuggestions(data.features || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [place, selectedLocation, supabase, userLocation]);

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
      toast.error(err.message || "Failed to create run.");
      setLoading(false);
    }
  };



  const todayString = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];

  return (
    <PageTransition>
      <div className="flex flex-col min-h-screen bg-[var(--surface-page)]">
      <header className="px-6 py-5 bg-[var(--surface-page)]/80 backdrop-blur-md z-10 sticky top-0">
        <button
          onClick={() => router.back()}
          className="text-[#71717a] font-semibold text-sm hover:opacity-80 transition"
        >
          Cancel
        </button>
      </header>

      <main className="flex-1 p-6 pb-24">
        <div className="mb-8">
          <h1 className="text-[32px] font-extrabold tracking-[-0.03em] text-[var(--foreground)] mb-1">Create Run</h1>
          <p className="text-[#71717a] text-sm">Takes less than 30 seconds.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Title */}
          <div className="relative">
            <Type className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717a]" />
            <input
              type="text"
              placeholder="Morning 5K Loop"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent border-0 border-b-[1.5px] border-[var(--border-card)] rounded-none pt-[12px] pb-[8px] pl-[40px] pr-4 text-[var(--foreground)] focus:outline-none focus:ring-0 focus:border-b-[#8b5cf6] transition-colors duration-200 appearance-none"
              maxLength={40}
              required
            />
          </div>

          {/* 2. Structured Date & Time Inputs (Side-by-side) */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Clock className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717a]" />
              <input
                type="date"
                min={todayString}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-transparent border-0 border-b-[1.5px] border-[var(--border-card)] rounded-none pt-[12px] pb-[8px] pl-[40px] pr-0 text-[var(--foreground)] focus:outline-none focus:ring-0 focus:border-b-[#8b5cf6] transition-colors duration-200 appearance-none cursor-pointer"
                required
              />
            </div>
            <div className="relative flex-1">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-transparent border-0 border-b-[1.5px] border-[var(--border-card)] rounded-none pt-[12px] pb-[8px] px-2 text-[var(--foreground)] focus:outline-none focus:ring-0 focus:border-b-[#8b5cf6] transition-colors duration-200 appearance-none cursor-pointer text-center"
                required
              />
            </div>
          </div>

          {/* 3. Distance */}
          <div className="relative">
            <Route className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717a]" />
            <input
              type="text"
              placeholder="e.g. 5, 10, 13.1"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="w-full bg-transparent border-0 border-b-[1.5px] border-[var(--border-card)] rounded-none pt-[12px] pb-[8px] pl-[40px] pr-24 text-[var(--foreground)] focus:outline-none focus:ring-0 focus:border-b-[#8b5cf6] transition-colors duration-200 appearance-none"
              required
            />
            <div style={{ display:'flex', gap:2, position:'absolute', right:0, top:'50%', transform:'translateY(-50%)' }}>
              {['mi','km'].map(u => (
                <button 
                  key={u} 
                  type="button"
                  onClick={() => setUnit(u as 'mi'|'km')} 
                  style={{ padding:'4px 10px', borderRadius:'var(--radius-sm)', background: unit===u ? 'var(--aurora-subtle)' : 'transparent', border: unit===u ? '1px solid rgba(99,102,241,.3)' : '1px solid transparent', color: unit===u ? '#8b5cf6' : '#71717a', fontSize:12, fontWeight:500, cursor:'pointer' }}
                >
                  {u.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Pace Dropdown */}
          <div className="relative">
            <Gauge className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717a]" />
            <select
              value={pace}
              onChange={(e) => setPace(e.target.value)}
              className="w-full bg-transparent border-0 border-b-[1.5px] border-[var(--border-card)] rounded-none pt-[12px] pb-[8px] pl-[40px] pr-4 text-[var(--foreground)] focus:outline-none focus:ring-0 focus:border-b-[#8b5cf6] transition-colors duration-200 appearance-none cursor-pointer"
            >
              <option value="Easy">Easy</option>
              <option value="Tempo">Tempo</option>
              <option value="Fartlek">Fartlek</option>
              <option value="Long Run">Long Run</option>
            </select>
          </div>

          {/* 5. Natural Text Location Place Input with Autocomplete */}
          <div className="relative">
            <MapPin className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717a]" />
            <input
              ref={placeInputRef}
              type="text"
              placeholder="Search meeting spot"
              value={place}
              onChange={(e) => {
                setPlace(e.target.value);
                setSelectedLocation(null); // invalidate selection if they type
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && suggestions.length > 0) {
                  e.preventDefault();
                  (document.querySelector('[role="option"]') as HTMLElement)?.focus();
                }
              }}
              className="w-full bg-transparent border-0 border-b-[1.5px] border-[var(--border-card)] rounded-none pt-[12px] pb-[8px] pl-[40px] pr-12 text-[var(--foreground)] focus:outline-none focus:ring-0 focus:border-b-[#8b5cf6] transition-colors duration-200 appearance-none"
              required
            />
            {isSearching && (
              <Loader2 className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8b5cf6] animate-spin" />
            )}

            {/* Suggestions Dropdown */}
            {suggestions.length > 0 && (
              <div 
                className="absolute z-20 w-full mt-2 overflow-hidden max-h-60 overflow-y-auto"
                style={{ background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,.12)' }}
              >
                {suggestions.map((feature, i) => {
                  const props = feature.properties;
                  const title = props.name || props.street || props.city || "Unknown Location";
                  const display_name = [props.name, props.street, props.city, props.state].filter(Boolean).join(', ');
                  return (
                    <button
                      key={i}
                      type="button"
                      role="option"
                      onClick={() => {
                        setPlace(title);
                        setSelectedLocation({ 
                          lat: feature.geometry.coordinates[1], 
                          lon: feature.geometry.coordinates[0], 
                          display_name: title 
                        });
                        setSuggestions([]);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          (e.currentTarget.nextElementSibling as HTMLElement)?.focus();
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          const prev = e.currentTarget.previousElementSibling as HTMLElement;
                          if (prev) {
                            prev.focus();
                          } else {
                            placeInputRef.current?.focus();
                          }
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setSuggestions([]);
                          placeInputRef.current?.focus();
                        }
                      }}
                      className="w-full text-left focus:outline-none hover:bg-[var(--surface-subtle)] transition-colors"
                      style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--border-card)' }}
                    >
                      <p className="font-bold text-[var(--foreground)] text-sm mb-0.5 pointer-events-none">{title}</p>
                      <p className="text-xs text-[#71717a] truncate leading-tight pointer-events-none">{display_name}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>{error}</p>}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full text-white flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50 mt-8"
            style={{ background: 'var(--aurora-primary)', fontSize: 15, fontWeight: 600, borderRadius: 'var(--radius-md)', padding: '16px 24px' }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Post run"}
          </button>
        </form>
      </main>
    </div>
    </PageTransition>
  );
}
