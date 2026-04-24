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
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-slate-200 bg-white">
        <button onClick={() => router.push("/")} className="text-slate-500 hover:text-slate-900 transition">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-bold text-slate-900">Profile</span>
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className="text-indigo-600 font-bold text-sm bg-indigo-50 px-4 py-2 rounded-full">
            Edit
          </button>
        ) : (
          <button onClick={handleSaveProfile} disabled={loading} className="text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-full flex items-center gap-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4"/> Save</>}
          </button>
        )}
      </header>

      <main className="flex-1 px-6 py-8">
        {/* Profile Photo Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl bg-slate-100 flex items-center justify-center">
              {uploadingImage ? (
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              ) : profile.profile_image_url ? (
                <img src={profile.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl">🏃</span>
              )}
            </div>
            
            {/* Edit Photo Overlay */}
            {isEditing && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center transition opacity-100 backdrop-blur-sm"
              >
                <Camera className="w-8 h-8 text-white" />
              </button>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload}
            />
          </div>

          {/* Name Display/Edit */}
          <div className="mt-5 text-center w-full max-w-xs flex flex-col items-center gap-3">
            {isEditing ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-xl font-black text-center bg-white border border-slate-200 rounded-xl px-4 py-3 w-full focus:outline-none focus:border-indigo-500 shadow-sm"
                  placeholder="Your Name"
                />
                <input
                  type="text"
                  value={editZipCode}
                  onChange={(e) => setEditZipCode(e.target.value)}
                  className="text-sm font-semibold text-center bg-white border border-slate-200 rounded-xl px-4 py-3 w-full focus:outline-none focus:border-indigo-500 shadow-sm"
                  placeholder="Zip Code (ex: 10001)"
                  maxLength={10}
                />
                <div className="w-full flex items-center justify-between bg-white px-5 py-4 rounded-xl border border-slate-200 mt-1 shadow-sm">
                  <span className="font-semibold text-slate-700 text-sm">Push Notifications</span>
                  <button 
                    type="button" 
                    onClick={() => setEditNotifications(!editNotifications)} 
                    className={`w-12 h-6 rounded-full transition-colors relative ${editNotifications ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full transition-all duration-200 shadow-sm ${editNotifications ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-black text-slate-900">{profile.full_name || "Runner"}</h1>
                {profile.zip_code && (
                  <span className="text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full flex items-center gap-1">
                    📍 {profile.zip_code}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Gamification Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tier</p>
              <p className="text-lg font-black text-slate-900">{profile.tier || "Beginner"}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
              <Trophy className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Impact</p>
              <div className="flex items-center gap-1">
                <p className="text-lg font-black text-slate-900">{profile.fist_bump_count || 0}</p>
                <p className="text-sm font-bold text-slate-400 mt-1">bumps</p>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
              <Flame className="w-6 h-6" />
            </div>
          </div>
        </div>
        
        {/* Support logout */}
        {!isEditing && (
            <button 
                onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}
                className="w-full py-4 text-slate-400 font-bold hover:bg-slate-200 rounded-xl transition"
            >
                Log Out
            </button>
        )}
      </main>
    </div>
  );
}
