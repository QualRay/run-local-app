"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Edit2, Check, Camera, Trophy, Flame } from "lucide-react";

type UserProfile = {
  id: string;
  full_name: string;
  profile_image_url: string | null;
  tier: string;
  fist_bump_count: number;
  zip_code: string | null;
  notifications_enabled: boolean;
};

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editZipCode, setEditZipCode] = useState("");
  const [editNotifications, setEditNotifications] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setEditName(data.full_name || "");
        setEditZipCode(data.zip_code || "");
        setEditNotifications(data.notifications_enabled || false);
      }
      setLoading(false);
    }
    getProfile();
  }, [router, supabase]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !profile) return;
    
    setUploadingImage(true);
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${profile.id}-${Math.random()}.${fileExt}`;

    try {
      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Update public.users database instantly
      await supabase
        .from('users')
        .update({ profile_image_url: publicUrl })
        .eq('id', profile.id);

      // 4. Update local state
      setProfile((prev) => prev ? { ...prev, profile_image_url: publicUrl } : null);
    } catch (error) {
      console.error("Error uploading image: ", error);
      alert("Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile || !editName.trim()) return;
    
    setLoading(true);
    const { error } = await supabase
      .from("users")
      .update({ 
        full_name: editName.trim(),
        zip_code: editZipCode.trim() || null,
        notifications_enabled: editNotifications
      })
      .eq("id", profile.id);

    if (!error) {
      setProfile({ ...profile, full_name: editName.trim(), zip_code: editZipCode.trim() || null, notifications_enabled: editNotifications });
      setIsEditing(false);
    }
    setLoading(false);
  };

  if (loading && !profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--surface-page)]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="flex flex-col min-h-screen bg-[var(--surface-page)]">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between bg-[var(--surface-page)]/80 backdrop-blur-md sticky top-0 z-20">
        <button onClick={() => router.push("/")} className="text-[#71717a] hover:opacity-80 transition">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-semibold tracking-[-0.01em] text-[var(--foreground)]" style={{ fontSize: 14 }}>Profile</span>
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className="font-bold text-sm px-4 py-2 rounded-full" style={{ background:'var(--aurora-subtle)', color:'#8b5cf6', border:'1px solid rgba(99,102,241,.2)' }}>
            Edit
          </button>
        ) : (
          <button onClick={handleSaveProfile} disabled={loading} className="font-bold text-sm px-4 py-2 rounded-full flex items-center gap-1" style={{ background:'var(--aurora-subtle)', color:'#8b5cf6', border:'1px solid rgba(99,102,241,.2)' }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4"/> Save</>}
          </button>
        )}
      </header>

      <main className="flex-1 pb-8">
        {/* Profile Photo Section */}
        <div style={{ background:'var(--surface-subtle)', paddingTop:48, paddingBottom:32, display:'flex', flexDirection:'column', alignItems:'center', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', inset:0, background:'var(--aurora-mesh)', opacity:0.6, zIndex:0 }} />
          <div className="relative group z-10 flex flex-col items-center">
            <div style={{ padding:3, borderRadius:'50%', background:'var(--aurora-primary)', display:'inline-block' }}>
              <div style={{ background:'var(--surface-page)', borderRadius:'50%', padding:2 }}>
                <div className="w-32 h-32 rounded-full overflow-hidden bg-[var(--surface-subtle)] flex items-center justify-center relative">
                  {uploadingImage ? (
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  ) : profile.profile_image_url ? (
                    <img src={profile.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">🏃</span>
                  )}
                  {/* Edit Photo Overlay */}
                  {isEditing && (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center transition opacity-100 backdrop-blur-sm"
                    >
                      <Camera className="w-8 h-8 text-white" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload}
            />
          </div>

          {/* Name Display/Edit */}
          <div className="mt-5 text-center w-full max-w-xs flex flex-col items-center gap-3 relative z-10">
            {isEditing ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-xl font-black text-center bg-[var(--surface-card)] text-[var(--foreground)] border border-[var(--border-card)] rounded-xl px-4 py-3 w-full focus:outline-none focus:border-indigo-500 shadow-sm"
                  placeholder="Your Name"
                />
                <input
                  type="text"
                  value={editZipCode}
                  onChange={(e) => setEditZipCode(e.target.value)}
                  className="text-sm font-semibold text-center bg-[var(--surface-card)] text-[var(--foreground)] border border-[var(--border-card)] rounded-xl px-4 py-3 w-full focus:outline-none focus:border-indigo-500 shadow-sm"
                  placeholder="Zip Code (ex: 10001)"
                  maxLength={10}
                />
                <div className="w-full flex items-center justify-between bg-[var(--surface-card)] px-5 py-4 rounded-xl border border-[var(--border-card)] mt-1 shadow-sm">
                  <span className="font-semibold text-[var(--foreground)] text-sm">Push Notifications</span>
                  <button 
                    type="button" 
                    onClick={() => setEditNotifications(!editNotifications)} 
                    className={`w-12 h-6 rounded-full transition-colors relative ${editNotifications ? 'bg-[#8b5cf6]' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full transition-all duration-200 shadow-sm ${editNotifications ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-[var(--foreground)] tracking-[-0.02em]" style={{ fontSize: 22, fontWeight: 700 }}>{profile.full_name || "Runner"}</h1>
                {profile.zip_code && (
                  <span className="text-sm font-bold flex items-center gap-1 px-3 py-1" style={{ background:'var(--aurora-subtle)', color:'#8b5cf6', borderRadius:'var(--radius-sm)' }}>
                    📍 {profile.zip_code}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <div className="px-6 mt-8">
          {/* Gamification Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-5 flex flex-col justify-center items-center text-center" style={{ background:'var(--surface-subtle)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)' }}>
              <p className="text-xs font-bold text-[#71717a] uppercase tracking-widest mb-2">Tier</p>
              <p className="aurora-text" style={{ fontSize: 18, fontWeight: 700 }}>{profile.tier || "Beginner"}</p>
            </div>

            <div className="p-5 flex flex-col justify-center items-center text-center" style={{ background:'var(--surface-subtle)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)' }}>
              <p className="text-xs font-bold text-[#71717a] uppercase tracking-widest mb-2">Impact</p>
              <div className="flex items-baseline gap-1">
                <p className="aurora-text" style={{ fontSize: 28, fontWeight: 800 }}>{profile.fist_bump_count || 0}</p>
                <p className="text-sm font-bold text-[#71717a]">bumps</p>
              </div>
            </div>
          </div>
          
          {/* Support logout */}
          {!isEditing && (
              <button 
                  onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}
                  className="w-full py-4 rounded-xl transition hover:bg-[var(--surface-subtle)]"
                  style={{ color: '#71717a', fontWeight: 500 }}
              >
                  Log Out
              </button>
          )}
        </div>
      </main>
    </div>
  );
}
