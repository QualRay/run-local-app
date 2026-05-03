'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, Compass, PlusCircle, Users, User } from 'lucide-react'

export default function TabBar() {
  const pathname = usePathname()
  
  const isActive = (route: string) => route === '/' ? pathname === '/' : pathname.startsWith(route)

  const tabs = [
    { id: 'home', label: 'Home', icon: Home, route: '/' },
    { id: 'discover', label: 'Discover', icon: Compass, route: '/discover' },
    { id: 'create', label: 'Create', icon: PlusCircle, route: '/create' },
    { id: 'social', label: 'Social', icon: Users, route: '/social', hasUnread: false },
    { id: 'profile', label: 'Profile', icon: User, route: '/profile' },
  ]

  return (
    <div className="fixed bottom-[24px] left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-[360px] bg-[rgba(255,255,255,0.85)] dark:bg-[rgba(17,17,17,0.85)] backdrop-blur-[20px] rounded-full border-[0.5px] border-[var(--border-card)] px-4 py-2 flex justify-between items-center z-50">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = isActive(tab.route)
        const isCreate = tab.id === 'create'
        
        return (
          <Link key={tab.id} href={tab.route} className="relative flex flex-col items-center gap-[3px] group">
            {isCreate ? (
              <div 
                className="flex flex-col items-center gap-[3px] px-4 py-2 rounded-full border-[0.5px] border-[rgba(99,102,241,0.25)]"
                style={{ background: 'var(--aurora-subtle)' }}
              >
                <Icon className="w-5 h-5 text-[#8b5cf6]" />
                <span className="text-[10px] font-medium text-[#8b5cf6]">
                  {tab.label}
                </span>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Icon className={`w-5 h-5 ${active ? 'text-[#8b5cf6]' : 'text-[var(--color-text-secondary)]'}`} />
                  {tab.id === 'social' && tab.hasUnread && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#ef4444]" />
                  )}
                </div>
                <span className={`text-[10px] font-medium ${active ? 'text-[#8b5cf6]' : 'text-[var(--color-text-secondary)]'}`}>
                  {tab.label}
                </span>
                <div className="h-1 flex items-center justify-center">
                  <AnimatePresence>
                    {active && (
                      <motion.div 
                        layoutId="tab-dot" 
                        className="w-1 h-1 rounded-full"
                        style={{ background: 'var(--aurora-primary)' }} 
                      />
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </Link>
        )
      })}
    </div>
  )
}
