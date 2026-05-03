'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Search, MapPin, Calendar, Users, Loader2 } from 'lucide-react'

export default function DiscoverPage() {
  const router = useRouter()
  const supabase = createClient()

  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [coordsLoading, setCoordsLoading] = useState(true)
  const [allRuns, setAllRuns] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  // Location Lock
  useEffect(() => {
    async function determineLocation() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from("users")
            .select("zip_code")
            .eq("id", user.id)
            .single()

          if (profile && profile.zip_code) {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&postalcode=${encodeURIComponent(profile.zip_code)}&countrycodes=us`)
            const geocodeData = await res.json()
            if (geocodeData && geocodeData.length > 0) {
              const parsedLat = parseFloat(geocodeData[0].lat)
              const parsedLon = parseFloat(geocodeData[0].lon)
              if (!isNaN(parsedLat) && !isNaN(parsedLon)) {
                setCoords({
                  lat: parsedLat,
                  lon: parsedLon,
                })
                setCoordsLoading(false)
                return
              }
            }
          }
        }
      } catch (err) {
        console.warn("Zip code geocoding failed, falling back to browser...")
      }

      if (!navigator.geolocation) {
        setCoordsLoading(false)
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({ lat: position.coords.latitude, lon: position.coords.longitude })
          setCoordsLoading(false)
        },
        (error) => {
          console.error("Location error:", error)
          setCoordsLoading(false)
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      )
    }

    determineLocation()
  }, [supabase])

  // Fetch Runs
  useEffect(() => {
    // We fetch runs even if coords failed, so users can still discover runs globally
    if (coordsLoading) return

    async function fetchRuns() {
      const { data, error } = await supabase
        .from("runs")
        .select("*, run_participants(count)")
        .gte("start_time", new Date().toISOString())
        .eq("status", "active")

      if (!error && data) {
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

        let processedRuns = data.map((run: any) => {
          const loc = parseLocation(run.location);
          let dist = null;
          if (loc && coords) {
            dist = haversineDistance(coords.lat, coords.lon, loc.lat, loc.lon);
          }
          return {
            ...run,
            lat: loc?.lat,
            lon: loc?.lon,
            distance_away_miles: dist,
            participants_count: run.run_participants?.[0]?.count || 0
          };
        })
        
        // Sort by distance if we have coords, otherwise sort by start_time
        if (coords) {
          processedRuns.sort((a, b) => (a.distance_away_miles || 9999) - (b.distance_away_miles || 9999))
        } else {
          processedRuns.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        }

        setAllRuns(processedRuns)
      }
    }

    fetchRuns()
  }, [coords, coordsLoading, supabase])

  const filteredRuns = useMemo(() => {
    let result = allRuns

    if (searchQuery) {
      result = result.filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.location_label?.toLowerCase().includes(searchQuery.toLowerCase()))
    }

    if (activeFilter) {
      const now = new Date()
      if (activeFilter === 'Today') {
        result = result.filter(r => {
          const rDate = new Date(r.start_time)
          return rDate.toDateString() === now.toDateString()
        })
      } else if (activeFilter === 'This week') {
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        result = result.filter(r => {
          const rDate = new Date(r.start_time)
          return rDate >= now && rDate <= nextWeek
        })
      } else if (activeFilter === 'Easy' || activeFilter === 'Tempo' || activeFilter === 'Long Run') {
        result = result.filter(r => (r.pace_min_mile || '').toLowerCase().includes(activeFilter.toLowerCase()))
      } else if (activeFilter === '5K') {
        result = result.filter(r => r.distance_miles < 4)
      } else if (activeFilter === '10K+') {
        result = result.filter(r => r.distance_miles >= 6)
      }
    }

    return result
  }, [allRuns, searchQuery, activeFilter])

  const filters = ['Today', 'This week', 'Easy', 'Tempo', 'Long Run', '5K', '10K+']

  return (
    <div className="flex flex-col min-h-screen bg-[var(--surface-page)] pb-24">
      {/* Header */}
      <header className="p-6 pb-4 bg-[var(--surface-page)]/80 backdrop-blur-md sticky top-0 z-20 border-b border-[var(--border-card)]">
        <h1 className="text-3xl font-black tracking-tighter aurora-text inline-block mb-1">Discover.</h1>
        <p className="font-semibold text-[#71717a] uppercase tracking-[0.07em] text-[10px] mt-0">FIND LOCAL RUNS</p>
      </header>

      {/* FILTER CHIPS & SEARCH */}
      <div className="px-4 py-4 space-y-4 sticky top-[82px] bg-[var(--surface-page)] z-10 border-b border-[var(--border-card)]">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a]" />
          <input 
            type="text" 
            placeholder="Search titles or locations..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-[var(--border-card)] pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#8b5cf6] placeholder:text-[#71717a] shadow-sm text-[var(--foreground)] bg-[var(--surface-card)]"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
          {filters.map(filter => {
            const isActive = activeFilter === filter
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(isActive ? null : filter)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold border transition-colors ${
                  isActive 
                    ? 'border-[rgba(99,102,241,.3)] text-[#8b5cf6]' 
                    : 'bg-[var(--surface-card)] border-[var(--border-card)] text-[#71717a] hover:bg-[var(--surface-subtle)]'
                }`}
                style={{
                  background: isActive ? 'var(--aurora-subtle)' : undefined
                }}
              >
                {filter}
              </button>
            )
          })}
        </div>
      </div>

      {/* LIST VIEW */}
      <div className="p-4 space-y-4 flex-1">
        {coordsLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#8b5cf6]" />
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="text-center text-[#71717a] py-20 text-sm bg-[var(--surface-card)] border border-dashed border-[var(--border-card)] rounded-3xl mx-2">
            <MapPin className="w-10 h-10 mx-auto text-[#71717a] opacity-50 mb-3" />
            <p className="font-bold text-[var(--foreground)] text-base mb-1">No runs found</p>
            <p>Try adjusting your search or filters.</p>
          </div>
        ) : (
          filteredRuns.map(run => (
            <div 
              key={run.id}
              onClick={() => router.push('/run/' + run.id)}
              className="bg-[var(--surface-card)] border border-[var(--border-card)] p-5 rounded-[24px] cursor-pointer active:scale-[0.98] transition-transform relative overflow-hidden"
            >
              {/* Distance badge top right */}
              {run.distance_away_miles !== null && (
                <div className="absolute top-5 right-5 bg-[var(--surface-subtle)] px-2.5 py-1 rounded-full border border-[var(--border-card)] flex items-center gap-1 text-[10px] font-bold text-[var(--foreground)] uppercase tracking-wider">
                  <MapPin className="w-3 h-3 text-[#8b5cf6]" />
                  {run.distance_away_miles.toFixed(1)} mi
                </div>
              )}

              <h3 className="font-black text-[18px] text-[var(--foreground)] pr-20 mb-1 leading-tight">{run.title}</h3>
              
              <div className="flex gap-2 items-center mb-4">
                <span className="text-xs font-bold text-[#8b5cf6] bg-[var(--aurora-subtle)] px-2 py-0.5 rounded border border-[rgba(99,102,241,.2)]">{run.distance_miles} mi</span>
                <span className="text-xs font-bold text-[#71717a] bg-[var(--surface-subtle)] px-2 py-0.5 rounded border border-[var(--border-card)]">{run.pace_min_mile}</span>
              </div>

              <div className="space-y-2 text-xs font-medium text-[#71717a]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#a1a1aa]" />
                  <span className="text-[var(--foreground)]">{new Date(run.start_time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {run.location_label && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#a1a1aa]" />
                    <span className="truncate pr-4">{run.location_label}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Users className="w-4 h-4 text-[#a1a1aa]" />
                  <span><strong className="text-[var(--foreground)]">{run.participants_count}</strong> {run.participants_count === 1 ? 'runner' : 'runners'} going</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
