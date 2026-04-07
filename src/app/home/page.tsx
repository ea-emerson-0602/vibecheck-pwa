"use client";
// src/app/home/page.tsx
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { subscribeToPush, registerServiceWorker } from "@/lib/push";
import { MoodOrb } from "@/components/MoodOrb";
import { BottomNav } from "@/components/BottomNav";
import { MOODS, getMood, MoodKey, Profile, MoodEntry } from "@/types";
import { formatDistanceToNow } from "date-fns";

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [myLatestMood, setMyLatestMood] = useState<MoodEntry | null>(null);
  const [partnerLatestMood, setPartnerLatestMood] = useState<MoodEntry | null>(
    null,
  );
  const [showPicker, setShowPicker] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(null);
  const [note, setNote] = useState("");
  const [hugSent, setHugSent] = useState(false);
  const [unmatchPending, setUnmatchPending] = useState(false);
  const [incomingHug, setIncomingHug] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [appReady, setAppReady] = useState(false);

  const [showWidgetPrompt, setShowWidgetPrompt] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load profile & moods ──────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }

      // Register push
      await registerServiceWorker();
      const sub = await subscribeToPush();
      if (sub) {
        await supabase
          .from("profiles")
          .update({
            push_subscription: JSON.stringify(sub),
          })
          .eq("id", user.id);
      }

      // Load my profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(prof);

      // Load my latest mood
      const { data: mood } = await supabase
        .from("mood_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setMyLatestMood(mood ?? null);

      if (prof?.partner_id) {
        loadPartner(prof.partner_id);
      }
      setAppReady(true);
    };
    init();
  }, []);

  const loadPartner = async (partnerId: string) => {
    const { data: partnerProf } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", partnerId)
      .maybeSingle();
    setPartnerProfile(partnerProf);

    const { data: partnerMood } = await supabase
      .from("mood_entries")
      .select("*")
      .eq("user_id", partnerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setPartnerLatestMood(partnerMood ?? null);
  };

  // ── Realtime subscriptions ────────────────────────────────────────────────

  useEffect(() => {
    if (!profile) return;

    // Listen for partner's new moods
    const moodSub = supabase
      .channel("partner-moods")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mood_entries",
          filter: `user_id=eq.${profile.partner_id}`,
        },
        (payload) => {
          setPartnerLatestMood(payload.new as MoodEntry);
          const mood = getMood(payload.new.mood as MoodKey);
          showToast(
            `${partnerProfile?.display_name} is feeling ${mood.label} ${mood.emoji}`,
          );
        },
      )
      .subscribe();

    // Listen for incoming hugs
    const hugSub = supabase
      .channel("my-hugs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "hugs",
          filter: `to_user_id=eq.${profile.id}`,
        },
        (payload) => {
          setIncomingHug(payload.new.from_name);
          // Delete it after showing
          supabase
            .from("hugs")
            .delete()
            .eq("id", payload.new.id)
            .then(() => {});
        },
      )
      .subscribe();

    // Listen for unmatch request on my profile
    const unmatchSub = supabase
      .channel("unmatch-watch")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${profile.id}`,
        },
        (payload) => {
          const updated = payload.new as Profile;
          setProfile(updated);
          if (updated.unmatch_requested && !unmatchPending) {
            showToast(
              `${partnerProfile?.display_name} wants to unmatch — check the Connect tab`,
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(moodSub);
      supabase.removeChannel(hugSub);
      supabase.removeChannel(unmatchSub);
    };
  }, [profile?.id, profile?.partner_id, partnerProfile]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleSaveMood = async () => {
    if (!selectedMood || !profile) return;
    setSaving(true);

    try {
      const { data: newMood, error } = await supabase
        .from("mood_entries")
        .insert({
          user_id: profile.id,
          mood: selectedMood,
          note: note.trim(),
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error("Mood save error:", error);
        showToast("Failed to save mood, try again");
        return;
      }

      setMyLatestMood(
        newMood ?? {
          id: "",
          user_id: profile.id,
          mood: selectedMood,
          note: note.trim(),
          created_at: new Date().toISOString(),
        },
      );

      setShowPicker(false);
      setSelectedMood(null);
      setNote("");

      // After saving mood, trigger partner's widget refresh
      if (profile.partner_id) {
        fetch("/api/widget-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ record: { user_id: profile.id } }),
        }).catch(() => {});
      }

      if (profile.partner_id) {
        const mood = getMood(selectedMood);
        fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toUserId: profile.partner_id,
            title: `${profile.display_name} is feeling ${mood.label} ${mood.emoji}`,
            body: note.trim()
              ? `"${note.trim()}"`
              : "Check in on their vibe ✨",
          }),
        }).catch(() => {});
      }
    } catch (e) {
      console.error(e);
      showToast("Something went wrong");
    } finally {
      setSaving(false);
    }
  };
  const handleSendHug = async () => {
    if (!profile?.partner_id || hugSent) return;
    await supabase.from("hugs").insert({
      to_user_id: profile.partner_id,
      from_name: profile.display_name,
    });
    // Send push notification
    fetch("/api/hug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toUserId: profile.partner_id,
        fromName: profile.display_name,
      }),
    }).catch(() => {});
    setHugSent(true);
    setTimeout(() => setHugSent(false), 3000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const myMood = myLatestMood ? getMood(myLatestMood.mood as MoodKey) : null;

  if (!appReady) {
    return (
      <main className="min-h-screen bg-ink flex flex-col items-center justify-center relative overflow-hidden">
        {/* Ambient blobs */}
        <motion.div
          className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(124,58,237,0.15), transparent 70%)",
          }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-10%] right-[-10%] w-80 h-80 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(244,114,182,0.12), transparent 70%)",
          }}
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />

        {/* Pulsing orb */}
        <div className="relative flex items-center justify-center mb-8">
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 160,
              height: 160,
              background:
                "radial-gradient(circle, rgba(192,132,252,0.15), transparent 70%)",
            }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 100,
              height: 100,
              background:
                "radial-gradient(circle, rgba(192,132,252,0.2), transparent 70%)",
            }}
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.9, 0.4] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.3,
            }}
          />
          <motion.div
            className="relative rounded-full flex items-center justify-center"
            style={{
              width: 80,
              height: 80,
              background: "linear-gradient(135deg, #c084fc, #818cf8)",
              boxShadow: "0 0 40px rgba(192,132,252,0.5)",
            }}
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.span
              className="text-3xl"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              ✨
            </motion.span>
          </motion.div>
        </div>

        {/* App name */}
        <motion.h1
          className="font-display text-3xl font-bold text-white mb-2 tracking-tight"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          VibeCheck
        </motion.h1>

        <motion.p
          className="text-white/30 text-sm mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          How are you feeling today?
        </motion.p>

        {/* Loading dots */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-purple-400"
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </main>
    );
  }
  const theirMood = partnerLatestMood
    ? getMood(partnerLatestMood.mood as MoodKey)
    : null;
  const chosenMood = selectedMood ? getMood(selectedMood) : null;

  return (
    <main className="min-h-screen bg-ink pb-32 relative overflow-hidden">
      {/* BG gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-purple-900/20 blur-3xl" />
        {myMood && (
          <motion.div
            key={myMood.key}
            className="absolute bottom-0 left-0 w-80 h-80 rounded-full blur-3xl opacity-10"
            style={{ background: myMood.color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
          />
        )}
      </div>

      <div className="relative z-10 max-w-sm mx-auto px-5 pt-14">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-white/30 text-xs font-semibold tracking-widest uppercase">
              Hey
            </p>
            <h1 className="font-display text-2xl font-bold text-white">
              {profile?.display_name?.split(" ")[0]} 👋
            </h1>
          </div>
          <button
            onClick={handleSignOut}
            className="text-white/20 text-xs hover:text-white/40 transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* My Vibe */}
        <section className="mb-10">
          <p className="text-white/25 text-[10px] font-bold tracking-widest uppercase mb-5">
            Your Vibe
          </p>
          <div className="flex flex-col items-center">
            {myMood ? (
              <motion.div
                key={myMood.key}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-2"
              >
                <MoodOrb mood={myMood} size={150} />
                {myLatestMood?.note && (
                  <p
                    className="text-sm italic text-center mt-2"
                    style={{ color: myMood.color + "bb" }}
                  >
                    "{myLatestMood.note}"
                  </p>
                )}
                <p className="text-white/20 text-xs mt-1">
                  {formatDistanceToNow(new Date(myLatestMood!.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </motion.div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-white/25 text-sm">
                  Tap below to set your vibe ✨
                </p>
              </div>
            )}

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setShowPicker(true)}
              className="mt-6 w-full py-4 rounded-2xl bg-gradient-to-r from-purple-500/80 to-purple-700/80 text-white font-semibold text-sm backdrop-blur-sm border border-purple-400/20"
            >
              {myMood ? "Update My Vibe" : "Set My Vibe"}
            </motion.button>
          </div>
        </section>

        {/* Partner Vibe */}
        {profile?.partner_id ? (
          <section className="mb-6">
            <p className="text-white/25 text-[10px] font-bold tracking-widest uppercase mb-5">
              {partnerProfile?.display_name
                ? `${partnerProfile.display_name}'s Vibe`
                : "Their Vibe"}
            </p>

            <div className="glass rounded-3xl p-6 flex flex-col items-center gap-3">
              {theirMood ? (
                <motion.div
                  key={theirMood.key}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-2"
                >
                  <MoodOrb mood={theirMood} size={120} />
                  {partnerLatestMood?.note && (
                    <p
                      className="text-sm italic text-center"
                      style={{ color: theirMood.color + "bb" }}
                    >
                      "{partnerLatestMood.note}"
                    </p>
                  )}
                  <p className="text-white/20 text-xs">
                    {formatDistanceToNow(
                      new Date(partnerLatestMood!.created_at),
                      { addSuffix: true },
                    )}
                  </p>
                </motion.div>
              ) : (
                <p className="text-white/25 text-sm py-4">
                  {partnerProfile?.display_name || "They"} hasn't set their vibe
                  yet
                </p>
              )}

              {/* Hug button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSendHug}
                disabled={hugSent}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-all border ${
                  hugSent
                    ? "bg-purple-500/15 border-purple-400/30 text-purple-300"
                    : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                }`}
              >
                {hugSent
                  ? "Hug sent! 💌"
                  : `Send ${partnerProfile?.display_name || "them"} a hug 🫂`}
              </motion.button>
            </div>
          </section>
        ) : (
          <section>
            <div className="glass rounded-3xl p-6 text-center">
              <p className="text-white/30 text-xs font-bold tracking-widest uppercase mb-3">
                Your Code
              </p>
              <p className="font-display text-4xl font-bold text-purple-400 tracking-widest mb-2">
                {profile?.partner_code}
              </p>
              <p className="text-white/30 text-sm">
                Share with your partner on the Connect tab ♡
              </p>
            </div>
          </section>
        )}
      </div>

      {/* Mood Picker Sheet */}
      <AnimatePresence>
        {showPicker && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPicker(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-3xl border-t border-white/8 max-h-[90vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="p-6 pb-10">
                <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-6" />
                <h2 className="font-display text-xl font-bold text-center mb-2">
                  How are you feeling?
                </h2>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => {
                      setShowPicker(false);
                      setSelectedMood(null);
                      setNote("");
                    }}
                    className="flex-1 py-4 rounded-2xl text-white/40 text-sm font-semibold border border-white/10 bg-white/5"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={handleSaveMood}
                    disabled={!selectedMood || saving}
                    className="flex-[2] py-4 rounded-2xl text-white text-base font-bold disabled:opacity-30 transition-all"
                    style={{
                      background: chosenMood
                        ? `linear-gradient(135deg, ${chosenMood.color}, ${chosenMood.secondaryColor})`
                        : "rgba(255,255,255,0.08)",
                    }}
                  >
                    {saving
                      ? "Saving..."
                      : selectedMood
                        ? `OK — I'm ${getMood(selectedMood).label} ${getMood(selectedMood).emoji}`
                        : "Pick a mood first"}
                  </motion.button>
                </div>

                {/* Preview orb */}
                <div className="flex justify-center my-6 h-28">
                  <AnimatePresence mode="wait">
                    {chosenMood ? (
                      <motion.div
                        key={chosenMood.key}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                      >
                        <MoodOrb
                          mood={chosenMood}
                          size={90}
                          showLabel={false}
                        />
                      </motion.div>
                    ) : (
                      <motion.p
                        key="placeholder"
                        className="text-5xl opacity-20 self-center"
                      >
                        ✨
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Mood grid */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  {MOODS.map((mood) => {
                    const isSelected = selectedMood === mood.key;
                    return (
                      <motion.button
                        key={mood.key}
                        whileTap={{ scale: 0.88 }}
                        onClick={() => setSelectedMood(mood.key)}
                        className="flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all duration-150"
                        style={{
                          backgroundColor: isSelected
                            ? mood.color + "22"
                            : "rgba(255,255,255,0.03)",
                          borderColor: isSelected
                            ? mood.color + "66"
                            : "rgba(255,255,255,0.06)",
                        }}
                      >
                        <span className="text-2xl">{mood.emoji}</span>
                        <span
                          className="text-[10px] font-semibold"
                          style={{
                            color: isSelected
                              ? mood.color
                              : "rgba(255,255,255,0.4)",
                          }}
                        >
                          {mood.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Note input */}
                {selectedMood && (
                  <motion.input
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    type="text"
                    placeholder="Add a note... (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={80}
                    className="w-full px-4 py-3 rounded-xl glass text-white placeholder-white/20 text-sm outline-none mb-4"
                    style={{ borderColor: chosenMood?.color + "33" }}
                  />
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => {
                      setShowPicker(false);
                      setSelectedMood(null);
                      setNote("");
                    }}
                    className="flex-1 py-4 rounded-2xl text-white/40 text-sm font-semibold border border-white/10 bg-white/5"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={handleSaveMood}
                    disabled={!selectedMood || saving}
                    className="flex-[2] py-4 rounded-2xl text-white text-base font-bold disabled:opacity-30 transition-all shadow-lg"
                    style={{
                      background: chosenMood
                        ? `linear-gradient(135deg, ${chosenMood.color}, ${chosenMood.secondaryColor})`
                        : "rgba(255,255,255,0.08)",
                      boxShadow: chosenMood
                        ? `0 8px 32px ${chosenMood.color}55`
                        : "none",
                    }}
                  >
                    {saving
                      ? "Saving..."
                      : selectedMood
                        ? `OK — I'm ${getMood(selectedMood).label} ${getMood(selectedMood).emoji}`
                        : "Pick a mood first"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Incoming hug alert */}
      <AnimatePresence>
        {incomingHug && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 40 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-8"
          >
            <div className="glass rounded-3xl p-8 text-center border border-pink-500/20 shadow-2xl max-w-xs w-full">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6, repeat: 2 }}
                className="text-6xl mb-4"
              >
                🫂
              </motion.div>
              <h3 className="font-display text-xl font-bold mb-1">
                You got a hug!
              </h3>
              <p className="text-white/50 text-sm mb-6">
                {incomingHug} is thinking of you ♡
              </p>
              <button
                onClick={() => setIncomingHug(null)}
                className="w-full py-3 rounded-xl bg-pink-500/20 border border-pink-400/30 text-pink-300 font-semibold text-sm"
              >
                💕 Send love back
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 glass rounded-2xl px-5 py-3 text-sm text-white/80 border border-white/10 max-w-[85vw] text-center"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
      <AnimatePresence>
        {showWidgetPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-24 left-4 right-4 z-50"
          >
            <div className="glass rounded-2xl p-4 border border-purple-500/20 shadow-2xl max-w-sm mx-auto">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">🧩</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm mb-0.5">
                    Add the home screen widget
                  </p>
                  <p className="text-white/40 text-xs leading-relaxed">
                    See your partner's mood right on your home screen without
                    opening the app. Install the VibeCheck widget app to get
                    started.
                  </p>
                </div>
                <button
                  onClick={() => setShowWidgetPrompt(false)}
                  className="text-white/20 text-lg shrink-0 hover:text-white/40 leading-none"
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setShowWidgetPrompt(false)}
                  className="flex-1 py-2 rounded-xl text-white/30 text-xs font-semibold bg-white/5"
                >
                  Not now
                </button>
                <a
                  href="https://github.com/yourusername/vibecheck-widget/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowWidgetPrompt(false)}
                  className="flex-[2] py-2 rounded-xl bg-purple-500/30 border border-purple-400/30 text-purple-300 text-xs font-semibold text-center"
                >
                  Get Widget App →
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
