"use client";
// src/app/history/page.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { BottomNav } from "@/components/BottomNav";
import { getMood, MoodKey, MoodEntry, Profile } from "@/types";
import { format } from "date-fns";

type Tab = "mine" | "theirs";

export default function HistoryPage() {
  const router = useRouter();
  const supabase = createClient();

  const [myHistory, setMyHistory] = useState<MoodEntry[]>([]);
  const [partnerHistory, setPartnerHistory] = useState<MoodEntry[]>([]);
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("mine");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

      const { data: mine } = await supabase
        .from("mood_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      setMyHistory(mine ?? []);

      if (prof?.partner_id) {
        const { data: partner } = await supabase.from("profiles").select("*").eq("id", prof.partner_id).maybeSingle();
        setPartnerProfile(partner);

        const { data: theirs } = await supabase
          .from("mood_entries")
          .select("*")
          .eq("user_id", prof.partner_id)
          .order("created_at", { ascending: false })
          .limit(30);
        setPartnerHistory(theirs ?? []);
      }

      setLoading(false);
    };
    load();
  }, []);

  const displayHistory = activeTab === "mine" ? myHistory : partnerHistory;

  return (
    <main className="min-h-screen bg-ink pb-32">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-72 h-72 rounded-full bg-purple-900/10 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-sm mx-auto px-5 pt-14">
        <h1 className="font-display text-3xl font-bold mb-1">History</h1>
        <p className="text-white/30 text-sm mb-6">Your vibe timeline 📖</p>

        {/* Tab toggle */}
        <div className="flex glass rounded-2xl p-1 mb-6">
          <button
            onClick={() => setActiveTab("mine")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "mine" ? "bg-purple-500/30 text-white" : "text-white/30"
            }`}
          >
            Mine
          </button>
          <button
            onClick={() => setActiveTab("theirs")}
            disabled={!partnerProfile}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-30 ${
              activeTab === "theirs" ? "bg-purple-500/30 text-white" : "text-white/30"
            }`}
          >
            {partnerProfile?.display_name?.split(" ")[0] ?? "Partner"}
          </button>
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
          </div>
        ) : displayHistory.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📖</p>
            <p className="text-white/30 text-sm">No vibes yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayHistory.map((entry, i) => {
              const mood = getMood(entry.mood as MoodKey);
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex gap-4 items-start"
                >
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center pt-1 shrink-0">
                    <div
                      className="w-3 h-3 rounded-full shrink-0 shadow-lg"
                      style={{ backgroundColor: mood.color, boxShadow: `0 0 8px ${mood.color}88` }}
                    />
                    {i < displayHistory.length - 1 && (
                      <div className="w-px flex-1 min-h-8 mt-1" style={{ backgroundColor: mood.color + "22" }} />
                    )}
                  </div>

                  {/* Card */}
                  <div
                    className="flex-1 glass rounded-2xl p-4 mb-1 border"
                    style={{ borderColor: mood.color + "18" }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{mood.emoji}</span>
                      <span className="font-semibold text-sm" style={{ color: mood.color }}>
                        {mood.label}
                      </span>
                    </div>
                    {entry.note && (
                      <p className="text-white/50 text-xs italic mb-1">"{entry.note}"</p>
                    )}
                    <p className="text-white/20 text-xs">
                      {format(new Date(entry.created_at), "MMM d · h:mm a")}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
