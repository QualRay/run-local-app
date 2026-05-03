import { createClient } from '@/utils/supabase/server'
import { MapPin, LogIn } from 'lucide-react'
import RunFeed from '@/components/RunFeed'
import Link from 'next/link'

export default async function Index() {
  const supabase = createClient()
  
  // Real Server-Side Auth Check
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('profile_image_url, full_name')
      .eq('id', user.id)
      .single();
    profile = data;
  }

  return (
    <div className="flex flex-col h-full bg-[var(--surface-page)] min-h-screen relative pb-20">
      {/* Dynamic Header */}
      <header className="p-6 pb-2 bg-[var(--surface-page)]/80 backdrop-blur-md sticky top-0 z-20 border-b border-[var(--border-card)]">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tighter aurora-text inline-block mb-1">RunLocal.</h1>
            <p className="font-semibold text-[#71717a] uppercase tracking-[0.07em] text-[10px] mt-0">COMMUNITY RUNS</p>
          </div>

          {user ? (
            <Link href="/profile" className="w-10 h-10 rounded-full text-white font-bold flex items-center justify-center shadow-md border-2 border-[var(--surface-card)] hover:scale-105 transition-transform active:scale-95 overflow-hidden" style={{ background: 'var(--aurora-primary)' }}>
              {profile?.profile_image_url ? (
                <img src={profile.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                profile?.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "U"
              )}
            </Link>
          ) : (
            <Link href="/login" className="bg-[var(--surface-subtle)] border border-[var(--border-card)] text-[var(--primary)] px-5 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 hover:opacity-80 transition active:scale-95">
              <LogIn className="w-4 h-4" />
              Log In
            </Link>
          )}
        </div>
      </header>

      <main className="px-6 pt-6 flex-1">
        <RunFeed />
      </main>
    </div>
  )
}

