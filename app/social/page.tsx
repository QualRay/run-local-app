'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2, Search, Users, Activity } from 'lucide-react'
import Image from 'next/image'

// timeAgo helper
const timeAgo = (d: string) => { 
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); 
  if(s < 60) return 'just now'; 
  if(s < 3600) return Math.floor(s / 60) + 'm ago'; 
  if(s < 86400) return Math.floor(s / 3600) + 'h ago'; 
  return Math.floor(s / 86400) + 'd ago'; 
}

export default function SocialPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [tab, setTab] = useState<'feed'|'runners'>('feed')
  const [feed, setFeed] = useState<any[]>([])
  const [runners, setRunners] = useState<any[]>([])
  const [followingIds, setFollowingIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string|null>(null)

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      setCurrentUserId(user.id)

      const [followsRes, feedRes, runnersRes] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
        supabase.from('activity_feed')
          .select('*, actor:users!actor_id(full_name, profile_image_url, tier), run:runs(title, start_time)')
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('users')
          .select('id, full_name, profile_image_url, tier, fist_bump_count, follower_count')
          .neq('id', user.id)
          .order('follower_count', { ascending: false })
      ])

      if (followsRes.data) {
        setFollowingIds(followsRes.data.map(f => f.following_id))
      }
      if (feedRes.data) {
        setFeed(feedRes.data)
      }
      if (runnersRes.data) {
        setRunners(runnersRes.data)
      }
      
      setLoading(false)
    }
    fetchData()
  }, [supabase])

  const handleFollow = async (e: React.MouseEvent, targetId: string) => {
    e.stopPropagation()
    const isFollowing = followingIds.includes(targetId)
    if (isFollowing) {
      setFollowingIds(prev => prev.filter(id => id !== targetId))
      await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', targetId)
    } else {
      setFollowingIds(prev => [...prev, targetId])
      await supabase.from('follows').insert([{ follower_id: currentUserId, following_id: targetId }])
    }
  }

  const filteredRunners = useMemo(() => {
    if (!search) return runners
    return runners.filter(r => r.full_name?.toLowerCase().includes(search.toLowerCase()))
  }, [runners, search])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-screen bg-[var(--surface-page)]">
        <Loader2 className="w-8 h-8 animate-spin text-[#8b5cf6]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-[var(--surface-page)]">
      {/* Header */}
      <header className="p-6 pb-4 bg-[var(--surface-page)]/80 backdrop-blur-md sticky top-0 z-20 border-b border-[var(--border-card)]">
        <h1 className="text-3xl font-black tracking-tighter aurora-text inline-block mb-1">Social.</h1>
        <p className="font-semibold text-[#71717a] uppercase tracking-[0.07em] text-[10px] mt-0">COMMUNITY FEED</p>
      </header>

      {/* SUB-TAB SWITCHER */}
      <div className="flex flex-row gap-2 p-4 pt-4">
        <button
          onClick={() => setTab('feed')}
          className={`px-5 py-2 text-sm font-semibold rounded-full border transition-all ${
            tab === 'feed'
              ? 'border-[rgba(99,102,241,.25)] text-[#8b5cf6]'
              : 'bg-transparent border-[var(--border-card)] text-[var(--color-text-secondary)] hover:bg-[var(--surface-subtle)]'
          }`}
          style={{ background: tab === 'feed' ? 'var(--aurora-subtle)' : undefined }}
        >
          Following
        </button>
        <button
          onClick={() => setTab('runners')}
          className={`px-5 py-2 text-sm font-semibold rounded-full border transition-all ${
            tab === 'runners'
              ? 'border-[rgba(99,102,241,.25)] text-[#8b5cf6]'
              : 'bg-transparent border-[var(--border-card)] text-[var(--color-text-secondary)] hover:bg-[var(--surface-subtle)]'
          }`}
          style={{ background: tab === 'runners' ? 'var(--aurora-subtle)' : undefined }}
        >
          Runners
        </button>
      </div>

      {/* FEED CONTENT */}
      {tab === 'feed' && (
        <div className="flex-1 px-4 mt-2">
          {followingIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[var(--border-card)] rounded-2xl mx-2 bg-[var(--surface-card)]">
              <Users className="w-10 h-10 text-[#71717a] mb-3 opacity-50" />
              <h3 className="text-base font-bold text-[var(--foreground)] mb-1">Your feed is quiet</h3>
              <p className="text-sm text-[#71717a] mb-6 max-w-[200px]">Follow runners to see their activity</p>
              <button 
                onClick={() => setTab('runners')}
                className="px-6 py-2.5 rounded-full text-white font-semibold text-sm transition-transform active:scale-[0.98]"
                style={{ background: 'var(--aurora-primary)' }}
              >
                Find Runners
              </button>
            </div>
          ) : feed.length === 0 ? (
            <div className="text-center text-[#71717a] py-10 text-sm">
              No recent activity found.
            </div>
          ) : (
            <div className="flex flex-col">
              {feed.map((item, index) => {
                const actorName = item.actor?.full_name || 'A runner'
                const actionText = item.type === 'hosted_run' ? 'hosted' : 'joined'
                const runTitle = item.run?.title || 'a run'
                
                return (
                  <div 
                    key={item.id} 
                    className={`flex items-start gap-4 py-4 cursor-pointer active:bg-[var(--surface-subtle)] transition-colors px-2 ${index !== feed.length - 1 ? 'border-b border-[var(--border-card)]' : ''}`}
                    onClick={() => router.push('/run/' + item.run_id)}
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--surface-subtle)] shrink-0 flex items-center justify-center font-bold text-[#71717a] border border-[var(--border-card)]">
                      {item.actor?.profile_image_url ? (
                        <Image
                          src={item.actor.profile_image_url}
                          alt={actorName ?? 'Runner'}
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                          sizes="32px"
                        />
                      ) : (
                        actorName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--foreground)] leading-snug pr-4">
                        <span className="font-bold">{actorName}</span>{' '}
                        <span className="text-[#a1a1aa]">{actionText}</span>{' '}
                        <span className="font-semibold text-[#8b5cf6]">{runTitle}</span>
                      </p>
                      <p className="text-xs text-[#71717a] mt-1 font-medium">{timeAgo(item.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* RUNNERS CONTENT */}
      {tab === 'runners' && (
        <div className="flex-1 flex flex-col">
          <div className="px-6 pb-2 border-b border-[var(--border-card)] sticky top-[88px] bg-[var(--surface-page)] z-10">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-0 top-1/2 -translate-y-1/2 text-[#71717a]" />
              <input 
                type="text" 
                placeholder="Search runners..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-transparent border-none py-3 pl-8 text-sm focus:outline-none focus:ring-0 text-[var(--foreground)] placeholder:text-[#71717a]"
              />
            </div>
          </div>
          <div className="flex flex-col pt-2">
            {filteredRunners.length === 0 ? (
              <div className="text-center text-[#71717a] py-10 text-sm">
                No runners found.
              </div>
            ) : (
              filteredRunners.map(runner => {
                const isFollowing = followingIds.includes(runner.id)
                return (
                  <div 
                    key={runner.id}
                    onClick={() => router.push('/runner/' + runner.id)}
                    className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-[var(--surface-subtle)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--surface-subtle)] shrink-0 flex items-center justify-center font-bold text-[#71717a] border border-[var(--border-card)]">
                        {runner.profile_image_url ? (
                          <Image
                            src={runner.profile_image_url}
                            alt={runner.full_name ?? 'Runner'}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                            sizes="32px"
                          />
                        ) : (
                          (runner.full_name || 'U').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[var(--foreground)]">{runner.full_name || 'Unknown Runner'}</h4>
                        {runner.tier && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--surface-card)] border border-[var(--border-card)] text-[#a1a1aa] mt-1 inline-block">
                            {runner.tier}
                          </span>
                        )}
                      </div>
                    </div>
                    {currentUserId !== runner.id && (
                      <button
                        onClick={(e) => handleFollow(e, runner.id)}
                        className={`text-[12px] font-bold px-3 py-1 rounded-full border transition-all ${
                          isFollowing 
                            ? 'bg-[var(--surface-subtle)] text-[var(--color-text-secondary)] border-[var(--border-card)]' 
                            : 'border-[rgba(99,102,241,.2)] text-[#8b5cf6]'
                        }`}
                        style={{ background: isFollowing ? undefined : 'var(--aurora-subtle)' }}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
