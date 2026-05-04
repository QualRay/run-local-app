"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Mail, User } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type AuthStep = "EMAIL" | "OTP" | "NAME";

export default function LoginPage() {
  const [step, setStep] = useState<AuthStep>("EMAIL");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [step]);

  // 1. Send Email OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    setStep("OTP");
    setLoading(false);
  };

  // 2. Verify Email OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp,
      type: "email",
    });

    if (verifyError) {
      setError("Invalid or expired code.");
      setLoading(false);
      return;
    }

    // Check if they need to setup a profile
    if (!data.user?.user_metadata?.full_name) {
      setStep("NAME");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh(); 
    }
  };

  // 3. Save Name
  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: authData, error: updateError } = await supabase.auth.updateUser({
      data: { full_name: name },
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Upsert into our Public table for geospatial lookups
    if (authData?.user?.id) {
        await supabase.from("users").upsert([
          { id: authData.user.id, full_name: name, phone: null },
        ]);
    }
    
    router.push("/");
    router.refresh();
  };

  return (
    <div className="aurora-bg-drift min-h-screen flex flex-col items-center justify-center p-6" style={{ willChange: 'background-position' }}>
      <div 
        className="max-w-sm w-full backdrop-blur-[20px] bg-[var(--surface-card)]/80 frosted-glass border border-[var(--border-card)] shadow-2xl relative z-10"
        style={{ borderRadius: 'var(--radius-xl)', padding: '40px 32px' }}
      >
        <div className="mb-8">
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] aurora-text mb-1">
            RunLocal.
          </h1>
          <p className="text-[#a1a1aa] text-[14px]">
            Find your pace. Find your people.
          </p>
        </div>

        <form
          onSubmit={
            step === "EMAIL"
              ? handleSendOtp
              : step === "OTP"
              ? handleVerifyOtp
              : handleSaveName
          }
          className="space-y-6"
        >
          <div className="relative">
            {step === "EMAIL" && (
              <div className="relative">
                <input
                  ref={inputRef}
                  type="email"
                  placeholder="name@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendOtp(e) }}
                  className="w-full bg-transparent border-b-[1.5px] border-[var(--border-card)] rounded-none pt-3 pb-2 pl-0 pr-8 text-[var(--foreground)] placeholder:text-[#71717a] focus:outline-none focus:border-[#8b5cf6] transition-colors"
                  required
                />
                <Mail className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717a] pointer-events-none" />
              </div>
            )}

            {step === "OTP" && (
              <div className="text-center">
                <p className="text-sm text-[#71717a] mb-4">
                  We sent a magic code to<br />
                  <strong className="text-[var(--foreground)] font-medium">{email}</strong>
                </p>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full bg-transparent border-b-[1.5px] border-[var(--border-card)] rounded-none pt-3 pb-2 pl-0 pr-8 text-[var(--foreground)] placeholder:text-[#71717a] focus:outline-none focus:border-[#8b5cf6] transition-colors text-center tracking-widest font-mono"
                    required
                    maxLength={6}
                  />
                </div>
              </div>
            )}

            {step === "NAME" && (
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="First and last name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent border-b-[1.5px] border-[var(--border-card)] rounded-none pt-3 pb-2 pl-0 pr-8 text-[var(--foreground)] placeholder:text-[#71717a] focus:outline-none focus:border-[#8b5cf6] transition-colors"
                  required
                  minLength={2}
                />
                <User className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717a] pointer-events-none" />
              </div>
            )}
            
            {error && (
              <p className="text-[#f87171] text-[12px] mt-2">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || (step === "EMAIL" && !email.includes("@"))}
            className="w-full text-white font-semibold transition-all duration-200 hover:opacity-90 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
            style={{
              background: 'var(--aurora-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 24px',
              fontFamily: 'var(--font-geist-sans)'
            }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {step === "EMAIL" && "Send Magic Link"}
                {step === "OTP" && "Verify Code"}
                {step === "NAME" && "Join Pack"}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </>
            )}
          </button>
          
          {step === "OTP" && (
            <button 
              type="button" 
              disabled={loading}
              onClick={() => { setStep('EMAIL'); setError(null); }}
              className="w-full text-center text-xs font-medium text-[#71717a] mt-4 hover:text-[var(--foreground)] transition-colors"
            >
              Wrong email address?
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
