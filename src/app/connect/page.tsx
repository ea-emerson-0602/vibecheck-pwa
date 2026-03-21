"use client";
// src/app/connect/page.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { BottomNav } from "@/components/BottomNav";
import { Profile } from "@/types";

export default function ConnectPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [theirCode, setTheirCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [unmatchPending, setUnmatchPending] = useState(false);
  const [partnerRequestedUnmatch, setPartnerRequestedUnmatch] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(prof);

      if (prof?.partner_id) {
        const { data: partner } = await supabase.from("profiles").select("*").eq("id", prof.partner_id).maybeSingle();
        setPartnerProfile(partner);
        setPartnerRequestedUnmatch(partner?.unmatch_requested ?? false);
      }
    };
    load();
  }, []);

  // Realtime watch for partner unmatch request
  useEffect(() => {
    if (!profile?.partner_id) return;
    const sub = supabase
      .channel("partner-unmatch")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${profile.partner_id}`,
      }, (payload) => {
        setPartnerRequestedUnmatch((payload.new as Profile).unmatch_requested);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [profile?.partner_id]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(profile?.partner_code ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "VibeCheck",
        text: `Connect with me on VibeCheck! My code: ${profile?.partner_code} ♡`,
      });
    } else {
      copyCode();
    }
  };

  const handleLink = async () => {
    if (!profile || !theirCode.trim()) return;
    setLoading(true);
    setError("");

    const { data: partner } = await supabase
      .from("profiles")
      .select("*")
      .eq("partner_code", theirCode.toUpperCase().trim())
      .maybeSingle();

    if (!partner) {
      setError("No one found with that code. Double-check and try again!");
      setLoading(false);
      return;
    }

    if (partner.id === profile.id) {
      setError("That's your own code 😄");
      setLoading(false);
      return;
    }

    // Link both profiles
    await supabase.from("profiles").update({ partner_id: partner.id }).eq("id", profile.id);
    await supabase.from("profiles").update({ partner_id: profile.id }).eq("id", partner.id);

    setProfile((p) => p ? { ...p, partner_id: partner.id } : p);
    setPartnerProfile(partner);
    setTheirCode("");
    setLoading(false);
  };

  const handleRequestUnmatch = async () => {
    if (!profile) return;
    await supabase.from("profiles").update({ unmatch_requested: true }).eq("id", profile.id);
    setUnmatchPending(true);
    // Notify partner via push
    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toUserId: profile.partner_id,
        title: `${profile.display_name} wants to unmatch 💔`,
        body: "Open VibeCheck to respond",
      }),
    }).catch(() => {});
  };

  const handleCancelUnmatch = async () => {
    if (!profile) return;
    await supabase.from("profiles").update({ unmatch_requested: false }).eq("id", profile.id);
    setUnmatchPending(false);
  };

  const handleConfirmUnmatch = async () => {
    if (!profile?.partner_id) return;
    // Clear partner links for both users
    await supabase.from("profiles").update({ partner_id: null, unmatch_requested: false }).eq("id", profile.id);
    await supabase.from("profiles").update({ partner_id: null, unmatch_requested: false }).eq("id", profile.partner_id);
    setProfile((p) => p ? { ...p, partner_id: null } : p);
    setPartnerProfile(null);
    setUnmatchPending(false);
    setPartnerRequestedUnmatch(false);
  };

  const handleDeclineUnmatch = async () => {
    if (!profile?.partner_id) return;
    await supabase.from("profiles").update({ unmatch_requested: false }).eq("id", profile.partner_id);
    setPartnerRequestedUnmatch(false);
  };

  return (
    <main className="min-h-screen bg-ink pb-32 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-purple-900/15 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-sm mx-auto px-5 pt-14">
        <h1 className="font-display text-3xl font-bold mb-1">Connect</h1>
        <p className="text-white/30 text-sm mb-8">Link up with your person ♡</p>

        {/* Already connected */}
        {profile?.partner_id ? (
          <div className="flex flex-col gap-4">
            {/* Connected card */}
            <div className="glass rounded-3xl p-6 text-center">
              <div className="text-4xl mb-3">🔗</div>
              <p className="font-display text-lg font-bold text-white mb-1">
                Connected with {partnerProfile?.display_name}
              </p>
              <p className="text-white/30 text-sm">You're sharing vibes in real time ♡</p>
            </div>

            {/* Partner requested unmatch */}
            <AnimatePresence>
              {partnerRequestedUnmatch && !unmatchPending && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-2xl p-5 border border-red-500/20"
                >
                  <p className="text-sm text-red-300 font-semibold mb-1">
                    💔 {partnerProfile?.display_name} wants to unmatch
                  </p>
                  <p className="text-white/30 text-xs mb-4">Do you agree to disconnect?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDeclineUnmatch}
                      className="flex-1 py-2.5 rounded-xl glass text-white/50 text-sm font-semibold"
                    >
                      No, stay ♡
                    </button>
                    <button
                      onClick={handleConfirmUnmatch}
                      className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-400/30 text-red-300 text-sm font-semibold"
                    >
                      Yes, unmatch
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Unmatch controls */}
            {unmatchPending ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass rounded-2xl p-4 border border-yellow-500/15 text-center"
              >
                <p className="text-yellow-300/70 text-sm mb-2">
                  ⏳ Waiting for {partnerProfile?.display_name} to confirm...
                </p>
                <button onClick={handleCancelUnmatch} className="text-white/25 text-xs underline">
                  Cancel request
                </button>
              </motion.div>
            ) : !partnerRequestedUnmatch ? (
              <button
                onClick={handleRequestUnmatch}
                className="text-white/20 text-sm text-center underline py-2"
              >
                Unmatch
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Your code */}
            <div className="glass rounded-3xl p-6">
              <p className="text-white/30 text-[10px] font-bold tracking-widest uppercase mb-3">Your Code</p>
              <p className="font-display text-5xl font-bold text-purple-400 tracking-widest mb-3">
                {profile?.partner_code}
              </p>
              <p className="text-white/30 text-xs mb-4">Share this with your partner</p>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={shareCode}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-500/80 to-purple-700/80 text-white font-semibold text-sm"
              >
                {copied ? "Copied! ✓" : "Share My Code 💌"}
              </motion.button>
            </div>

            {/* Enter their code */}
            <div className="glass rounded-3xl p-6">
              <p className="text-white/30 text-[10px] font-bold tracking-widest uppercase mb-4">Enter Their Code</p>
              <input
                type="text"
                placeholder="e.g. AB12CD"
                value={theirCode}
                onChange={(e) => setTheirCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/8 text-white text-xl font-bold tracking-widest text-center outline-none placeholder-white/15 mb-3"
              />
              {error && <p className="text-red-400 text-xs text-center mb-3">{error}</p>}
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleLink}
                disabled={!theirCode.trim() || loading}
                className="w-full py-3.5 rounded-xl bg-purple-500/20 border border-purple-400/25 text-purple-300 font-semibold text-sm disabled:opacity-30"
              >
                {loading ? "Linking..." : "Link Up ✨"}
              </motion.button>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
