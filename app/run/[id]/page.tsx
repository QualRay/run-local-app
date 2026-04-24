"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { MapPin, Users, Calendar, Clock, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import confetti from "canvas-confetti";

type RunData = {
  id: string;
  title: string;
  start_time: string;
  distance_miles: number;
  pace_min_mile: string;
  location: string;
  host_id: string;
};

const haptic = (pattern: number | number[]) => { 
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern); 
};

export default function RunDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClient();

  const [run, setRun] = useState<RunData | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [participantList, setParticipantList] = useState<any[]>([]);
  
    // States
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fist Bump States
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [fistBumpsGiven, setFistBumpsGiven] = useState<string[]>([]);

  useEffect(() => {
    async function loadRunDetails() {
      // 1. Fetch Run Basic Scope
      const { data: runData, error: runError } = await supabase
        .from("runs")
        .select("*")
        .eq("id", params.id)
        .single();
        
      if (runError) {
        setError("Run not found.");
        setLoading(false);
        return;
      }
      setRun(runData);

      // 2. Fetch User & Participation
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      
      const { data: participants, count } = await supabase
        .from("run_participants")
        .select(`
          *,
          users (
            id,
            full_name,
            profile_image_url,
            tier
          )
        `, { count: "exact" })
        .eq("run_id", params.id);

      setParticipantCount(count || 0);
      setParticipantList(participants || []);

      if (user && participants) {
        const joined = participants.some((p) => p.user_id === user.id);
        setHasJoined(joined);

        // Fetch their existing fist bumps instantly so UI remembers locally!
        const { data: bumps } = await supabase
           .from("fist_bumps")
           .select("to_user_id")
           .eq("run_id", params.id)
           .eq("from_user_id", user.id);
        
        if (bumps) setFistBumpsGiven(bumps.map(b => b.to_user_id));
      }
      
      setLoading(false);
    }

    loadRunDetails();

    // REALTIME SUBSCRIPTION
    const channel = supabase.channel(`run_participants_${params.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'run_participants', filter: `run_id=eq.${params.id}` },
        async (payload) => {
          const newUserId = payload.new.user_id;

          const { data: userData } = await supabase
            .from('users')
            .select('id, full_name, profile_image_url, tier')
            .eq('id', newUserId)
            .single();

          if (userData) {
             const newParticipant = {
                ...payload.new,
                users: userData
             };
             
             let wasAdded = false;
             setParticipantList(prev => {
                if (prev.some(p => p.user_id === newUserId)) return prev;
                wasAdded = true;
                return [...prev, newParticipant];
             });
             
             if (wasAdded) {
                setParticipantCount(c => c + 1);
             }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'run_participants', filter: `run_id=eq.${params.id}` },
        (payload) => {
           const removedUserId = payload.old.user_id;
           let wasRemoved = false;
           
           setParticipantList(prev => {
              if (!prev.some(p => p.user_id === removedUserId)) return prev;
              wasRemoved = true;
              return prev.filter(p => p.user_id !== removedUserId);
           });
           
           if (wasRemoved) {
              setParticipantCount(c => c - 1);
           }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.id, supabase]);

  const handleJoinRun = async () => {
    setError(null);
    if (!currentUserId) return router.push("/login");

    // 1 & 2. Optimistic Updates BEFORE the async call
    setHasJoined(true);
    setParticipantCount((prev) => prev + 1);
    
    const optimisticParticipant = {
      user_id: currentUserId,
      checked_in: false,
      users: {
        id: currentUserId,
        full_name: "", // Will render as "Runner (You)" 
        profile_image_url: null,
        tier: "Getting Started"
      }
    };
    
    setParticipantList((prev) => [...prev, optimisticParticipant]);
    setJoinLoading(true);

    const { error: joinError } = await supabase.from("run_participants").insert([{ run_id: params.id, user_id: currentUserId }]);

    // 3. Rollback on Error
    if (joinError) {
      if (joinError.code === '23505') {
        // 5. Silent success for duplicate constraint - keep optimistic state
        setJoinLoading(false);
        haptic([10, 50, 10]);
        toast.success("You're in! See you at the run");
        return;
      }
      
      // Rollback on actual failure
      setHasJoined(false);
      setParticipantCount((prev) => prev - 1);
      setParticipantList((prev) => prev.filter(p => p.user_id !== currentUserId));
      setJoinLoading(false);
      toast.error(`Failed to join run. ${joinError.message}`);
      return setError(`Failed to join run. ${joinError.message}`);
    }

    // 6. Keep Notification Trigger
    if (run?.host_id && run.host_id !== currentUserId) {
        const { createNotification } = await import('@/utils/notifications');
        await createNotification(
            run.host_id,
            "new_join",
            `A new runner has joined your run: ${run.title}`
        );
    }

    // 4. Removed window.location.reload()
    setJoinLoading(false);
    haptic([10, 50, 10]);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 }, colors: ['#4F46E5', '#10B981', '#F59E0B'] });
    toast.success("You're in! See you at the run");
  };

  const handleCheckIn = async () => {
    if (!currentUserId) return;
    setJoinLoading(true);
    
    const checkInTime = new Date().toISOString();
    const { error } = await supabase
      .from("run_participants")
      .update({ checked_in: true, checked_in_at: checkInTime })
      .eq("run_id", params.id)
      .eq("user_id", currentUserId);

    if (error) {
      toast.error("Failed to check in");
      setJoinLoading(false);
      return;
    }
    
    setParticipantList((prev) => 
      prev.map((p) => 
        p.user_id === currentUserId 
          ? { ...p, checked_in: true, checked_in_at: checkInTime }
          : p
      )
    );
    
    setJoinLoading(false);
    haptic([20, 30, 20, 30, 40]);
    confetti({ particleCount: 60, spread: 55, origin: { y: 0.6 }, colors: ['#10B981', '#34D399'] });
    toast.success("Checked in! You're at the starting line");
  };

  const handleFistBump = async (toUserId: string) => {
      if (!currentUserId) return;
      if (fistBumpsGiven.length >= 3) {
          haptic([5, 10, 5]);
          toast.warning("You've used all 3 fist bumps for this run");
          return;
      }
      
      const { error } = await supabase.from("fist_bumps").insert([
          { run_id: params.id, from_user_id: currentUserId, to_user_id: toUserId }
      ]);
      
      if (!error) {
          setFistBumpsGiven([...fistBumpsGiven, toUserId]);

          // --- DYNAMIC TIER GAMIFICATION ENGINE ---
          // Fetch the current bumps of the target user
          const { data: targetUser } = await supabase
            .from("users")
            .select("fist_bump_count")
            .eq("id", toUserId)
            .single();
            
          const newBumpCount = (targetUser?.fist_bump_count || 0) + 1;
          
          // Calculate new tier based on thresholds
          let newTier = "Beginner";
          if (newBumpCount >= 10) newTier = "Building Consistency";
          else if (newBumpCount >= 5) newTier = "Regular Runner";
          else if (newBumpCount >= 1) newTier = "Finding My Pace";
          
          // Update the target user's profile with their new stats & tier
          await supabase
            .from("users")
            .update({ fist_bump_count: newBumpCount, tier: newTier })
            .eq("id", toUserId);
            
          haptic(15);
          toast.success("Fist bump sent!");
      } else {
          toast.error("Could not send fist bump");
      }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!run || error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 px-6">
        <p className="text-slate-500">{error || "Could not load run."}</p>
      </div>
    );
  }

  const runDate = new Date(run.start_time);
  const isRunStarted = runDate <= new Date(); // Using start time passage to define "Run Event Live/Over"

  const now = new Date();
  const checkInStartTime = new Date(runDate.getTime() - 30 * 60000);
  const checkInEndTime = new Date(runDate.getTime() + 60 * 60000);
  const isCheckInAvailable = now >= checkInStartTime && now <= checkInEndTime;
  
  const currentUserParticipant = participantList.find(p => p.user_id === currentUserId);
  const isCheckedIn = currentUserParticipant?.checked_in || false;

  const getTierVariant = (tier: string): "default"|"secondary"|"outline"|"destructive" => {
    if (tier === 'Regular Runner') return 'default'
    if (tier === 'Building Consistency') return 'secondary'
    if (tier === 'Finding My Pace') return 'outline'
    return 'outline'
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-24">
      {/* Dynamic Header */}
      <header className="px-6 py-5 bg-transparent sticky top-0 z-10 flex justify-between items-center backdrop-blur-md">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center text-slate-800 hover:scale-105 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </header>

      {/* Map Preview Area (MVP Mock) */}
      <div className="w-full h-64 bg-slate-200 relative -mt-20 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#CBD5E1_2px,transparent_2px)] [background-size:16px_16px]"></div>
        <div className="bg-indigo-600 w-12 h-12 rounded-full flex items-center justify-center shadow-xl shadow-indigo-600/30 animate-pulse relative z-10 border-4 border-white">
          <MapPin className="text-white w-5 h-5" />
        </div>
      </div>

      <main className="px-6 -mt-8 relative z-20 space-y-6">
        
        {/* Core Details Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100">
          <h1 className="text-2xl font-black text-slate-900 leading-tight mb-4">{run.title}</h1>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-slate-700">
              <Calendar className="w-5 h-5 text-indigo-500 shrink-0" />
              <span className="font-medium">{runDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-700">
              <Clock className="w-5 h-5 text-indigo-500 shrink-0" />
              <span className="font-medium">{runDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-700">
              <Users className="w-5 h-5 text-indigo-500 shrink-0" />
              <div className="font-medium flex items-center gap-2">
                {participantCount} {participantCount === 1 ? 'runner' : 'runners'} going
                {hasJoined && (
                  <span className="bg-indigo-50 text-indigo-700 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md">
                    You're joining
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-indigo-50 p-5 rounded-3xl border border-indigo-100">
            <p className="text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">Distance</p>
            <p className="text-2xl font-black text-indigo-900">{parseFloat(Number(run.distance_miles).toFixed(2))} <span className="text-base font-semibold text-indigo-700">mi</span></p>
          </div>
          <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100">
            <p className="text-emerald-600 text-xs font-bold uppercase tracking-wider mb-1">Target Pace</p>
            <p className="text-2xl font-black text-emerald-900">{run.pace_min_mile}</p>
          </div>
        </div>

        {/* The Roster & Interactive UI */}
        <div className="pt-4">
          <div className="flex justify-between items-end mb-4">
            <h3 className="font-black text-slate-900 text-lg">Runners ({participantCount})</h3>
            {isRunStarted && hasJoined && (
               <p className="text-xs font-bold text-orange-500 uppercase tracking-widest">{3 - fistBumpsGiven.length} bumps left</p>
            )}
          </div>
          
          <div className="space-y-3">
            {participantList.map((p: any) => {
              const u = p.users;
              if (!u) return null;
              
              const isMe = u.id === currentUserId;
              const isBumped = fistBumpsGiven.includes(u.id);
              
              return (
                <div key={p.user_id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                      {u.profile_image_url ? (
                        <img src={u.profile_image_url} alt={u.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="w-full h-full flex justify-center items-center text-lg">🏃</span>
                      )}
                    </div>
                    <div className="flex flex-col">
                       <span className="font-bold text-slate-900 flex items-center gap-2">
                         {u.full_name || "Runner"} {isMe && <span className="text-slate-400 font-medium text-xs">(You)</span>}
                         {p.checked_in && <span title="Checked In"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></span>}
                       </span>
                       {!isRunStarted && (
                          <Badge variant={getTierVariant(u.tier)} className="text-[10px] mt-1">
                            {u.tier || "Getting Started"}
                          </Badge>
                       )}
                    </div>
                  </div>
                  
                  {/* Show Bump Action ONLY if run passed start time, user is participant, and target is NOT self */}
                  {isRunStarted && hasJoined && !isMe ? (
                     <button 
                       onClick={() => handleFistBump(u.id)}
                       disabled={isBumped || fistBumpsGiven.length >= 3}
                       className={`px-4 py-2 rounded-xl font-bold text-sm transition-all focus:outline-none flex items-center gap-2 ${
                          isBumped 
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                            : fistBumpsGiven.length >= 3 
                               ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                               : "bg-orange-100 text-orange-600 hover:bg-orange-200 active:scale-[0.95]"
                       }`}
                     >
                       {isBumped ? "Bumped!" : "👊 Bump"}
                     </button>
                  ) : (
                    isRunStarted && <Badge variant={getTierVariant(u.tier)} className="text-[10px] mt-1">{u.tier || "Getting Started"}</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-0 inset-x-0 p-6 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent z-30">
        <div className="max-w-md mx-auto">
          {hasJoined ? (
            isCheckedIn ? (
              <button disabled className="w-full bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 py-4 rounded-2xl shadow-lg cursor-not-allowed">
                <CheckCircle2 className="w-5 h-5" />
                Checked In
              </button>
            ) : isCheckInAvailable ? (
              <button
                onClick={handleCheckIn}
                disabled={joinLoading}
                className="w-full bg-orange-500 text-white font-semibold flex items-center justify-center gap-2 py-4 rounded-2xl shadow-lg hover:bg-orange-600 transition active:scale-[0.98]"
              >
                {joinLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                Check In Now
              </button>
            ) : (
              <button
                disabled
                className="w-full bg-slate-900 text-white font-semibold flex items-center justify-center gap-2 py-4 rounded-2xl shadow-lg opacity-90 cursor-not-allowed transition transform"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                You're in! 🎉
              </button>
            )
          ) : (
            <button
              onClick={handleJoinRun}
              disabled={joinLoading}
              className="w-full bg-indigo-600 disabled:bg-indigo-400 text-white font-semibold py-4 rounded-2xl shadow-[0_8px_30px_rgb(79,70,229,0.3)] hover:bg-indigo-500 flex items-center justify-center gap-2 transition active:scale-[0.98]"
            >
              {joinLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Join Run"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
