"use client";
// src/app/page.tsx — Auth gate: shows login if not signed in, redirects to /home
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/home");
      else setChecking(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name } },
      });
      if (error) throw error;

      // Show confirmation message instead of redirecting
      setError("");
      setLoading(false);
      setShowConfirmation(true);
      return;
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-ink flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-96 h-96 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 rounded-full bg-pink-600/10 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="text-6xl mb-4"
          >
            ✨
          </motion.div>
          <h1 className="font-display text-4xl font-bold text-white tracking-tight">
            VibeCheck
          </h1>
          <p className="text-sm text-white/40 mt-2 font-body">
            How are you feeling today?
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex glass rounded-2xl p-1 mb-6">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                mode === m
                  ? "bg-purple-500/30 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {m === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <AnimatePresence>
            {mode === "signup" && (
              <motion.input
                key="name"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3.5 rounded-xl glass text-white placeholder-white/25 text-sm outline-none focus:border-purple-500/50 transition-colors"
              />
            )}
          </AnimatePresence>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3.5 rounded-xl glass text-white placeholder-white/25 text-sm outline-none focus:border-purple-500/50 transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3.5 rounded-xl glass text-white placeholder-white/25 text-sm outline-none focus:border-purple-500/50 transition-colors"
          />

          {error && (
            <p className="text-red-400 text-xs text-center px-2">{error}</p>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-purple-700 text-white font-semibold text-sm mt-2 disabled:opacity-50 transition-opacity"
          >
            {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
          </motion.button>
        </form>
        {/* Email confirmation popup */}
        <AnimatePresence>
          {showConfirmation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/70 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="w-full max-w-sm rounded-3xl p-7 text-center"
                style={{
                  background: "#1c1530",
                  border: "1px solid rgba(192,132,252,0.2)",
                }}
              >
                <div className="text-5xl mb-4">📬</div>
                <h2 className="font-display text-xl font-bold text-white mb-2">
                  Check your inbox!
                </h2>
                <p className="text-white/50 text-sm leading-relaxed mb-2">
                  We sent a confirmation link to{" "}
                  <span className="text-purple-400">{email}</span>.
                </p>
                <p className="text-white/35 text-xs leading-relaxed mb-6">
                  Don't see it? Check your spam folder — it can sometimes take
                  up to 5 minutes to arrive.
                </p>
                <button
                  onClick={() => {
                    setShowConfirmation(false);
                    setMode("login");
                  }}
                  className="w-full py-3.5 rounded-2xl text-white text-sm font-bold"
                  style={{
                    background: "linear-gradient(135deg, #c084fc, #818cf8)",
                  }}
                >
                  Got it — take me to sign in
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
