'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Edit3, Send, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

export default function RunDashboard({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string|null>(null)
  
  const [run, setRun] = useState<any>(null)
  const [participants, setParticipants] = useState<any[]>([])
  
  const [editMode, setEditMode] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [sendingMsg, setSendingMsg] = useState(false)

  // Edit form states
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editDistance, setEditDistance] = useState('')
  const [editPace, setEditPace] = useState('')
  const [editLocation, setEditLocation] = useState('')

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUserId(user.id)

      const { data: runData } = await supabase
        .from('runs')
        .select('*')
        .eq('id', params.id)
        .single()

      if (!runData || runData.host_id !== user.id) {
        toast.error("Run not found or unauthorized")
        router.push('/dashboard')
        return
      }

      setRun(runData)
      
      // Initialize edit states
      setEditTitle(runData.title)
      const d = new Date(runData.start_time)
      const dLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      setEditDate(dLocal.toISOString().split('T')[0])
      setEditTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }))
      setEditDistance(runData.distance_miles?.toString() || '')
      setEditPace(runData.pace_min_mile || '')
      setEditLocation(runData.location_label || '')

      const { data: partData } = await supabase
        .from('run_participants')
        .select('*, user:users(full_name, profile_image_url)')
        .eq('run_id', params.id)

      if (partData) setParticipants(partData)

      setLoading(false)
    }

    fetchData()
  }, [params.id, router, supabase])

  const handleSaveEdit = async () => {
    const eventDate = new Date(`${editDate}T${editTime}:00`)
    const numericDistance = parseFloat(editDistance.replace(/[^\d.]/g, ''))
    
    if (isNaN(numericDistance) || !editTitle.trim()) {
      toast.error("Invalid title or distance")
      return
    }

    const { error } = await supabase
      .from('runs')
      .update({
        title: editTitle,
        start_time: eventDate.toISOString(),
        distance_miles: numericDistance,
        pace_min_mile: editPace,
        location_label: editLocation
      })
      .eq('id', params.id)
      .eq('host_id', currentUserId)

    if (error) {
      toast.error("Failed to update run")
    } else {
      toast.success("Run updated successfully")
      setRun({
        ...run,
        title: editTitle,
        start_time: eventDate.toISOString(),
        distance_miles: numericDistance,
        pace_min_mile: editPace,
        location_label: editLocation
      })
      setEditMode(false)
    }
  }

  const handleSendMessage = async () => {
    if (!messageText.trim()) return
    setSendingMsg(true)
    
    const notifications = participants.map(p => ({
      user_id: p.user_id,
      type: 'host_message',
      content: `${run.title}: ${messageText.trim()}`
    }))

    const { error } = await supabase.from('notifications').insert(notifications)
    
    setSendingMsg(false)
    
    if (error) {
      toast.error("Failed to send message")
    } else {
      toast.success(`Message sent to ${participants.length} runners`)
      setMessageText('')
    }
  }

  const handleCancelRun = async () => {
    const { error } = await supabase
      .from('runs')
      .update({ status: 'cancelled' })
      .eq('id', params.id)
      .eq('host_id', currentUserId)

    if (!error) {
      const notifications = participants.map(p => ({
        user_id: p.user_id,
        type: 'run_cancelled',
        content: `${run.title} has been cancelled by the host.`
      }))
      await supabase.from('notifications').insert(notifications)
      
      toast.success("Run cancelled")
      router.push('/dashboard')
    } else {
      toast.error("Failed to cancel run")
    }
  }

  if (loading || !run) {
    return (
      <div className="flex justify-center items-center h-full min-h-screen bg-[var(--surface-page)]">
        <Loader2 className="w-8 h-8 animate-spin text-[#8b5cf6]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--surface-page)] pb-24">
      {/* Header */}
      <header className="p-6 sticky top-0 z-20 flex items-center justify-between bg-[var(--surface-page)]/80 backdrop-blur-sm border-b border-[var(--border-card)]">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--surface-card)]/50 border border-[var(--border-card)] transition-transform active:scale-95">
          <ArrowLeft className="w-5 h-5 text-[var(--foreground)]" />
        </button>
        <h1 className="text-lg font-black tracking-tight aurora-text">Manage Run</h1>
        <div className="w-10 h-10" />
      </header>

      <div className="p-6 space-y-10">
        
        {/* SECTION 1 - Run details + edit */}
        <section className="bg-[var(--surface-card)] border border-[var(--border-card)] rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-[var(--foreground)] text-lg">Details</h2>
            {!editMode ? (
              <button onClick={() => setEditMode(true)} className="text-[#8b5cf6] flex items-center gap-1.5 text-sm font-bold">
                <Edit3 className="w-4 h-4" /> Edit
              </button>
            ) : (
              <button onClick={handleSaveEdit} className="text-[#8b5cf6] font-bold text-sm bg-[var(--aurora-subtle)] px-3 py-1.5 rounded-full border border-[rgba(99,102,241,.2)]">
                Save
              </button>
            )}
          </div>

          {!editMode ? (
            <div className="space-y-3 text-sm text-[var(--foreground)]">
              <p><strong className="text-[#71717a]">Title:</strong> {run.title}</p>
              <p><strong className="text-[#71717a]">Date/Time:</strong> {new Date(run.start_time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              <p><strong className="text-[#71717a]">Distance:</strong> {run.distance_miles} mi</p>
              <p><strong className="text-[#71717a]">Pace:</strong> {run.pace_min_mile}</p>
              <p><strong className="text-[#71717a]">Location:</strong> {run.location_label}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Title"
                className="w-full bg-transparent border-0 border-b-[1.5px] border-[var(--border-card)] pb-2 text-[var(--foreground)] focus:outline-none focus:border-b-[#8b5cf6] text-sm font-semibold"
              />
              <div className="flex gap-4">
                <input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="flex-1 bg-transparent border-0 border-b-[1.5px] border-[var(--border-card)] pb-2 text-[var(--foreground)] focus:outline-none focus:border-b-[#8b5cf6] text-sm font-semibold"
                />
                <input
                  type="time"
                  value={editTime}
                  onChange={e => setEditTime(e.target.value)}
                  className="flex-1 bg-transparent border-0 border-b-[1.5px] border-[var(--border-card)] pb-2 text-[var(--foreground)] focus:outline-none focus:border-b-[#8b5cf6] text-sm font-semibold text-center"
                />
              </div>
              <div className="flex gap-4">
                <input
                  type="number"
                  step="0.1"
                  value={editDistance}
                  onChange={e => setEditDistance(e.target.value)}
                  placeholder="Distance (mi)"
                  className="flex-1 bg-transparent border-0 border-b-[1.5px] border-[var(--border-card)] pb-2 text-[var(--foreground)] focus:outline-none focus:border-b-[#8b5cf6] text-sm font-semibold"
                />
                <select
                  value={editPace}
                  onChange={e => setEditPace(e.target.value)}
                  className="flex-1 bg-transparent border-0 border-b-[1.5px] border-[var(--border-card)] pb-2 text-[var(--foreground)] focus:outline-none focus:border-b-[#8b5cf6] text-sm font-semibold"
                >
                  <option value="Easy">Easy</option>
                  <option value="Tempo">Tempo</option>
                  <option value="Fartlek">Fartlek</option>
                  <option value="Long Run">Long Run</option>
                </select>
              </div>
              <input
                type="text"
                value={editLocation}
                onChange={e => setEditLocation(e.target.value)}
                placeholder="Location"
                className="w-full bg-transparent border-0 border-b-[1.5px] border-[var(--border-card)] pb-2 text-[var(--foreground)] focus:outline-none focus:border-b-[#8b5cf6] text-sm font-semibold"
              />
            </div>
          )}
        </section>

        {/* SECTION 2 - Roster */}
        <section>
          <h2 className="font-bold text-[var(--foreground)] mb-4 text-lg">Roster ({participants.length})</h2>
          {participants.length === 0 ? (
            <p className="text-sm text-[#71717a] py-4">No one has joined yet.</p>
          ) : (
            <div className="space-y-3">
              {participants.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-[var(--surface-card)] border border-[var(--border-card)] p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--surface-subtle)] border border-[var(--border-card)] flex items-center justify-center font-bold text-[#71717a] overflow-hidden">
                      {p.user?.profile_image_url ? (
                        <img src={p.user.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        (p.user?.full_name || 'U').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[var(--foreground)]">{p.user?.full_name || 'Unknown'}</h4>
                      {p.checked_in && p.checked_in_at && (
                        <p className="text-[10px] text-[#71717a] mt-0.5 font-medium">Checked in {new Date(p.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full uppercase tracking-wider border ${p.checked_in ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-[var(--surface-subtle)] text-[#a1a1aa] border-[var(--border-card)]'}`}>
                    {p.checked_in ? 'Checked in' : 'Not yet'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 3 - Message participants */}
        <section className="bg-[var(--surface-card)] border border-[var(--border-card)] rounded-2xl p-5">
          <h2 className="font-bold text-[var(--foreground)] mb-4 text-lg">Message participants</h2>
          <textarea
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            placeholder="Send a message to all participants..."
            className="w-full bg-transparent border-0 border-b-[1.5px] border-[var(--border-card)] pb-3 pt-2 text-[var(--foreground)] focus:outline-none focus:border-b-[#8b5cf6] text-sm resize-none mb-4 min-h-[60px]"
          />
          <div className="flex justify-end">
            <button
              onClick={handleSendMessage}
              disabled={sendingMsg || !messageText.trim() || participants.length === 0}
              className="text-white text-sm font-bold px-6 py-2.5 rounded-full flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
              style={{ background: 'var(--aurora-primary)' }}
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </div>
        </section>

        {/* SECTION 4 - Danger zone */}
        <section className="pt-4 border-t border-[var(--border-card)]">
          {!showCancelConfirm ? (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="w-full text-[#ef4444] border border-[#ef4444] font-bold text-sm py-3 rounded-xl transition-all active:scale-[0.98] bg-transparent"
            >
              Cancel this run
            </button>
          ) : (
            <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 p-5 rounded-2xl flex flex-col items-center text-center">
              <AlertTriangle className="w-8 h-8 text-[#ef4444] mb-3" />
              <p className="font-bold text-[#ef4444] mb-2">Are you absolutely sure?</p>
              <p className="text-xs text-[#ef4444]/80 font-medium mb-6">
                This will cancel the run and notify all participants. This cannot be undone.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 bg-[var(--surface-card)] text-[var(--foreground)] border border-[var(--border-card)] font-bold text-sm py-3 rounded-xl active:scale-[0.98] transition-transform"
                >
                  Keep run
                </button>
                <button
                  onClick={handleCancelRun}
                  className="flex-1 text-white font-bold text-sm py-3 rounded-xl active:scale-[0.98] transition-transform shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
                >
                  Yes, cancel run
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
