'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Calendar, MapPin } from 'lucide-react'

// timeAgo helper
const timeAgo = (d: string) => { 
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); 
  if(s < 60) return 'just now'; 
  if(s < 3600) return Math.floor(s / 60) + 'm ago'; 
  if(s < 86400) return Math.floor(s / 3600) + 'h ago'; 
  return Math.floor(s / 86400) + 'd ago'; 
}

const FistBumpSvg = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10 9.5V4a2 2 0 0 1 4 0v5.5" />
    <path d="M14 9.5V7a2 2 0 0 1 4 0v3" />
    <path d="M18 10v-1a2 2 0 0 1 4 0v5.5a8 8 0 0 1-8 8h-3a8 8 0 0 1-8-8v-2a2 2 0 0 1 2-2h1" />
    <path d="M7 11V6a2 2 0 0 1 4 0v5.5" />
  </svg>
)

export default function RunnerProfile({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [fistBumps, setFistBumps] = useState<any[]>([])
  const [upcomingRuns, setUpcomingRuns] = useState<any[]>([])
  const [pastRuns, setPastRuns] = useState<any[]>([])
  const [currentUserId, setCurrentUserId] = useState<string|null>(null)

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
         setLoading(false)
         return
      }
      setCurrentUserId(user.id)

      const runnerId = params.id

      // 1. Runner Profile
      const { data: profileData } = await supabase
        .from('users')
        .select('id, full_name, profile_image_url, tier, fist_bump_count, follower_count, following_count')
        .eq('id', runnerId)
        .single()
      
      if (profileData) {
        setProfile(profileData)
        setFollowerCount(profileData.follower_count || 0)
      }

      // 2. Is Following
      const { data: followData } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', runnerId)
        .maybeSingle()
      
      if (followData) setIsFollowing(true)

      // 3. Fist Bumps
      const { data: bumpsData } = await supabase
        .from('fist_bumps')
        .select('*, run:runs(title)')
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${runnerId}),and(from_user_id.eq.${runnerId},to_user_id.eq.${user.id})`)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (bumpsData) setFistBumps(bumpsData)

      // 4. Upcoming Runs & 5. Past Runs
      const now = new Date().toISOString()
      
      const { data: runsData } = await supabase
        .from('runs')
        .select('*, run_participants!inner(user_id)')
        .eq('run_participants.user_id', runnerId)
        .order('start_time', { ascending: true })

      if (runsData) {
        const upcoming = runsData.filter(r => r.start_time >= now).slice(0, 5)
        const past = runsData.filter(r => r.start_time < now).sort((a,b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()).slice(0, 5)
        setUpcomingRuns(upcoming)
        setPastRuns(past)
      }
      
      setLoading(false)
    }

    fetchData()
  }, [params.id, supabase])

  const handleFollowToggle = async () => {
    if (!currentUserId || !profile) return
    
    if (isFollowing) {
      setIsFollowing(false)
      setFollowerCount(prev => Math.max(0, prev - 1))
      await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', profile.id)
    } else {
      setIsFollowing(true)
      setFollowerCount(prev => prev + 1)
      await supabase.from('follows').insert([{ follower_id: currentUserId, following_id: profile.id }])
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-screen bg-[var(--surface-page)]">
        <Loader2 className="w-8 h-8 animate-spin text-[#8b5cf6]" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--surface-page)] items-center justify-center p-6">
        <p className="text-[#71717a] font-medium text-lg">Runner not found</p>
        <button onClick={() => router.back()} className="mt-4 text-[#8b5cf6] font-bold">Go Back</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--surface-page)] pb-24">
      {/* Header */}
      <header className="p-6 sticky top-0 z-20 flex items-center justify-between bg-transparent backdrop-blur-sm">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--surface-card)]/50 border border-[var(--border-card)] transition-transform active:scale-95">
          <ArrowLeft className="w-5 h-5 text-[var(--foreground)]" />
        </button>
        <h1 className="text-lg font-black tracking-tight aurora-text">Runner</h1>
        <div className="w-10 h-10" /> {/* Spacer */}
      </header>

      {/* Hero Section */}
      <div className="relative px-6 pb-8 pt-4 border-b border-[var(--border-card)] overflow-hidden">
        {/* Mesh Background */}
        <div className="absolute top-0 left-0 right-0 bottom-0 opacity-20 pointer-events-none" style={{
          background: 'radial-gradient(circle at 20% 0%, rgba(99,102,241,0.5) 0%, transparent 50%), radial-gradient(circle at 80% 100%, rgba(139,92,246,0.5) 0%, transparent 50%)',
          filter: 'blur(40px)'
        }} />

        <div className="flex flex-col items-center relative z-10 text-center">
          <div className="relative w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-[#8b5cf6] via-[#6366f1] to-[#ec4899] mb-4">
            <div className="w-full h-full bg-[var(--surface-page)] rounded-full overflow-hidden border-[3px] border-[var(--surface-page)] flex items-center justify-center font-bold text-3xl text-[#71717a]">
              {profile.profile_image_url ? (
                <img src={profile.profile_image_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                (profile.full_name || 'U').charAt(0).toUpperCase()
              )}
            </div>
          </div>
          
          <h2 className="text-2xl font-black text-[var(--foreground)] mb-1">{profile.full_name || 'Unknown Runner'}</h2>
          {profile.tier && (
            <span className="text-xs uppercase font-black tracking-wider aurora-text mb-6 inline-block">
              {profile.tier}
            </span>
          )}

          {currentUserId !== profile.id && (
            <button
              onClick={handleFollowToggle}
              className={`text-[14px] font-bold px-6 py-2 rounded-full border transition-all mb-6 ${
                isFollowing 
                  ? 'bg-[var(--surface-subtle)] text-[var(--color-text-secondary)] border-[var(--border-card)]' 
                  : 'border-[rgba(99,102,241,.2)] text-[#8b5cf6]'
              }`}
              style={{ background: isFollowing ? undefined : 'var(--aurora-subtle)' }}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}

          <div className="flex items-center justify-center gap-6 text-center w-full max-w-xs bg-[var(--surface-card)]/50 backdrop-blur-md p-4 rounded-2xl border border-[var(--border-card)]">
            <div className="flex flex-col items-center">
              <span className="font-bold text-[18px] text-[var(--foreground)] leading-none">{followerCount}</span>
              <span className="text-[11px] text-[#71717a] font-medium mt-1">Followers</span>
            </div>
            <div className="w-px h-8 bg-[var(--border-card)]" />
            <div className="flex flex-col items-center">
              <span className="font-bold text-[18px] text-[var(--foreground)] leading-none">{profile.following_count || 0}</span>
              <span className="text-[11px] text-[#71717a] font-medium mt-1">Following</span>
            </div>
            <div className="w-px h-8 bg-[var(--border-card)]" />
            <div className="flex flex-col items-center">
              <span className="font-bold text-[18px] text-[var(--foreground)] leading-none">{profile.fist_bump_count || 0}</span>
              <span className="text-[11px] text-[#71717a] font-medium mt-1">Bumps</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 space-y-10">
        
        {/* Fist bump history */}
        {fistBumps.length > 0 && (
          <section>
            <h3 className="font-bold text-[var(--foreground)] mb-4 text-lg">Fist bumps with you</h3>
            <div className="space-y-3">
              {fistBumps.map(bump => {
                const isFromMe = bump.from_user_id === currentUserId
                return (
                  <div key={bump.id} className="flex items-start gap-3 bg-[var(--surface-card)] border border-[var(--border-card)] p-3 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-[var(--aurora-subtle)] border border-[rgba(99,102,241,.2)] flex items-center justify-center shrink-0">
                      <FistBumpSvg className="w-4 h-4 text-[#8b5cf6]" />
                    </div>
                    <div>
                      <p className="text-sm text-[var(--foreground)] font-medium leading-snug">
                        {isFromMe ? `You bumped ${profile.full_name}` : `${profile.full_name} bumped you`}
                      </p>
                      {bump.run?.title && (
                        <p className="text-xs text-[#8b5cf6] font-semibold mt-0.5">{bump.run.title}</p>
                      )}
                      <p className="text-[10px] text-[#71717a] font-medium mt-1">{timeAgo(bump.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Upcoming Runs */}
        <section>
          <h3 className="font-bold text-[var(--foreground)] mb-4 text-lg">Upcoming runs</h3>
          {upcomingRuns.length === 0 ? (
            <p className="text-sm text-[#71717a] py-4 bg-[var(--surface-card)] border border-[var(--border-card)] rounded-2xl px-4 text-center">No upcoming runs</p>
          ) : (
            <div className="space-y-3">
              {upcomingRuns.map(run => (
                <div 
                  key={run.id}
                  onClick={() => router.push('/run/' + run.id)}
                  className="bg-[var(--surface-card)] border border-[var(--border-card)] p-4 rounded-2xl cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <h4 className="font-bold text-[var(--foreground)] text-sm mb-2 truncate">{run.title}</h4>
                  <div className="flex gap-4 text-xs text-[#71717a] font-medium">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-[#a1a1aa]" />
                      <span>{new Date(run.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    </div>
                    {run.location_label && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-[#a1a1aa]" />
                        <span className="truncate max-w-[120px]">{run.location_label}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Past Runs */}
        <section>
          <h3 className="font-bold text-[var(--foreground)] mb-4 text-lg">Past runs</h3>
          {pastRuns.length === 0 ? (
            <p className="text-sm text-[#71717a] py-4 bg-[var(--surface-card)] border border-[var(--border-card)] rounded-2xl px-4 text-center">No past runs</p>
          ) : (
            <div className="space-y-3 opacity-60 hover:opacity-100 transition-opacity">
              {pastRuns.map(run => (
                <div 
                  key={run.id}
                  onClick={() => router.push('/run/' + run.id)}
                  className="bg-[var(--surface-card)] border border-[var(--border-card)] p-4 rounded-2xl cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <h4 className="font-bold text-[var(--foreground)] text-sm mb-2 truncate">{run.title}</h4>
                  <div className="flex gap-4 text-xs text-[#71717a] font-medium">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-[#a1a1aa]" />
                      <span>{new Date(run.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    {run.location_label && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-[#a1a1aa]" />
                        <span className="truncate max-w-[120px]">{run.location_label}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
