import { createClient } from '@/utils/supabase/server'
import { MapPin, LogIn, Plus } from 'lucide-react'
import RunFeed from '@/components/RunFeed'
import Link from 'next/link'

export default async function Index() {
  const supabase = createClient()
  
  // Real Server-Side Auth Check
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex flex-col h-full bg-slate-50 min-h-screen relative pb-20">
      {/* Dynamic Header */}
      <header className="p-6 pb-2 bg-slate-50/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-100">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 border-b-2 border-indigo-500 inline-block">RunLocal.</h1>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">Community Runs</p>
          </div>

          {user ? (
            <Link href="/profile" className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shadow-md border-2 border-white hover:scale-105 transition-transform active:scale-95">
              {user.user_metadata?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </Link>
          ) : (
            <Link href="/login" className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 hover:bg-slate-800 transition active:scale-95 shadow-sm">
              <LogIn className="w-4 h-4" />
              Log In
            </Link>
          )}
        </div>
      </header>

      <main className="px-6 pt-6 flex-1">
        <RunFeed />
      </main>

      {/* Floating Action Button - Properly Routed */}
      <div className="fixed bottom-8 right-6 z-30">
        <Link 
          href={user ? "/create" : "/login"} 
          className="bg-indigo-600 hover:bg-indigo-500 text-white w-14 h-14 rounded-full shadow-[0_8px_30px_rgb(79,70,229,0.4)] flex items-center justify-center transition-all active:scale-95"
          aria-label="Create new run"
        >
          <Plus className="w-7 h-7" />
        </Link>
      </div>
    </div>
  )
}

