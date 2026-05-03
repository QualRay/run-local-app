'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowRight, Calendar, Users, CheckCircle2 } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [upcomingRuns, setUpcomingRuns] = useState<any[]>([])
  const [pastRuns, setPastRuns] = useState<any[]>([])

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('runs')
        .select('*, run_participants(id, checked_in)')
        .eq('host_id', user.id)
        .eq('status', 'active')
        .order('start_time', { ascending: true })

      if (data && !error) {
        const processedRuns = data.map((run: any) => ({
          ...run,
          participant_count: run.run_participants?.length || 0,
          checked_in_count: run.run_participants?.filter((p: any) => p.checked_in).length || 0
        }))
        
        const now = new Date().toISOString()
        setUpcomingRuns(processedRuns.filter(r => r.start_time >= now))
        
        const past = processedRuns.filter(r => r.start_time < now)
        past.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        setPastRuns(past)
      }
      setLoading(false)
    }
    fetchData()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-screen bg-[var(--surface-page)]">
        <Loader2 className="w-8 h-8 animate-spin text-[#8b5cf6]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-[var(--surface-page)]">
      <header className="p-6 sticky top-0 z-20 flex items-center justify-between bg-[var(--surface-page)]/80 backdrop-blur-sm border-b border-[var(--border-card)]">
        <h1 className="text-3xl font-black tracking-tighter aurora-text">My runs</h1>
        <Link 
          href="/create"
          className="text-white text-xs font-bold px-4 py-2 rounded-full active:scale-95 transition-transform shadow-md"
          style={{ background: 'var(--aurora-primary)' }}
        >
          Create run
        </Link>
      </header>

      <div className="p-6 space-y-10">
        <section>
          <h2 className="font-bold text-[var(--foreground)] mb-4 text-lg">Upcoming</h2>
          {upcomingRuns.length === 0 ? (
            <p className="text-sm text-[#71717a] py-4 bg-[var(--surface-card)] border border-[var(--border-card)] rounded-2xl px-4 text-center">No upcoming runs.</p>
          ) : (
            <div className="space-y-3">
              {upcomingRuns.map(run => (
                <Link 
                  key={run.id}
                  href={`/dashboard/${run.id}`}
                  className="flex items-center justify-between bg-[var(--surface-card)] border border-[var(--border-card)] p-4 rounded-2xl active:scale-[0.98] transition-transform"
                >
                  <div>
                    <h3 className="font-bold text-[var(--foreground)] text-[15px] mb-1">{run.title}</h3>
                    <p className="text-xs text-[#71717a] font-medium mb-3 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-[#a1a1aa]" />
                      {new Date(run.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <div className="flex items-center gap-4 text-xs font-medium">
                      <span className="flex items-center gap-1 text-[var(--foreground)]">
                        <Users className="w-3.5 h-3.5 text-[#8b5cf6]" /> {run.participant_count} joined
                      </span>
                      <span className="flex items-center gap-1 text-[var(--foreground)]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" /> {run.checked_in_count} checked in
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[#71717a]" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-bold text-[var(--foreground)] mb-4 text-lg">Past</h2>
          {pastRuns.length === 0 ? (
            <p className="text-sm text-[#71717a] py-4 bg-[var(--surface-card)] border border-[var(--border-card)] rounded-2xl px-4 text-center">No past runs.</p>
          ) : (
            <div className="space-y-3 opacity-60 hover:opacity-100 transition-opacity">
              {pastRuns.map(run => (
                <Link 
                  key={run.id}
                  href={`/dashboard/${run.id}`}
                  className="flex items-center justify-between bg-[var(--surface-card)] border border-[var(--border-card)] p-4 rounded-2xl active:scale-[0.98] transition-transform"
                >
                  <div>
                    <h3 className="font-bold text-[var(--foreground)] text-[15px] mb-1">{run.title}</h3>
                    <p className="text-xs text-[#71717a] font-medium mb-3 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-[#a1a1aa]" />
                      {new Date(run.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <div className="flex items-center gap-4 text-xs font-medium">
                      <span className="flex items-center gap-1 text-[var(--foreground)]">
                        <Users className="w-3.5 h-3.5 text-[#8b5cf6]" /> {run.participant_count} joined
                      </span>
                      <span className="flex items-center gap-1 text-[var(--foreground)]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" /> {run.checked_in_count} checked in
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[#71717a]" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
