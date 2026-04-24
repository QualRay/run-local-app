"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, AlertCircle, Mail, Hash, User } from "lucide-react";
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
    <div className="flex flex-col h-full bg-slate-50 min-h-screen">
      <header className="p-6 pb-2">
        <button
          onClick={() => router.push("/")}
          className="text-slate-500 font-semibold text-sm hover:text-slate-800 transition"
        >
          ← Back
        </button>
      </header>

      <main className="flex-1 flex flex-col justify-center px-6 pb-24 relative z-10">
        <div className="max-w-sm mx-auto w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">
              {step === "EMAIL" && "Let's run."}
              {step === "OTP" && "Enter code."}
              {step === "NAME" && "What's your name?"}
            </h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              {step === "EMAIL" && "Enter your email address to sign in instantly."}
              {step === "OTP" && `We sent a secure code to ${email}.`}
              {step === "NAME" && "You're verified! Just one last thing before you join the pack."}
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
            className="space-y-4"
          >
            <div className="relative">
              {step === "EMAIL" && (
                <>
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    ref={inputRef}
                    type="email"
                    placeholder="runner@local.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 placeholder:text-slate-400 shadow-sm font-medium transition"
                    required
                  />
                </>
              )}

              {step === "OTP" && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl py-6 px-4 text-center">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h3 className="text-indigo-900 font-bold mb-1">Check your inbox</h3>
                  <p className="text-indigo-700 text-sm">We sent a secure magic link to <br/><strong>{email}</strong></p>
                  <p className="text-indigo-500 text-xs mt-3">You can securely close this tab.</p>
                </div>
              )}

              {step === "NAME" && (
                <>
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="First and last name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-medium transition"
                    required
                    minLength={2}
                  />
                </>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-xl text-sm font-medium">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {step !== "OTP" && (
              <button
                type="submit"
                disabled={loading || (step === "EMAIL" && !email.includes("@"))}
                className="w-full bg-indigo-600 disabled:bg-indigo-400 text-white font-semibold py-4 rounded-2xl shadow-lg hover:bg-indigo-500 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {step === "EMAIL" ? "Send Magic Link" : "Complete account"}
                    {!loading && <ArrowRight className="w-5 h-5" />}
                  </>
                )}
              </button>
            )}
            
            {step === "OTP" && (
                <button 
                  type="button" 
                  disabled={loading}
                  onClick={() => { setStep('EMAIL'); setError(null); }}
                  className="w-full text-center text-sm font-semibold text-slate-500 mt-4 hover:text-slate-800 disabled:opacity-50"
                >
                    Wrong email address?
                </button>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
