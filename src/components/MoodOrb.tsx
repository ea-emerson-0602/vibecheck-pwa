"use client";
// src/components/MoodOrb.tsx
import { motion } from "framer-motion";
import { Mood } from "@/types";

interface Props {
  mood: Mood;
  size?: number;
  showLabel?: boolean;
}

export function MoodOrb({ mood, size = 160, showLabel = true }: Props) {
  const duration = mood.animationDuration;

  return (
    <div className="flex flex-col items-center gap-4" style={{ width: size * 1.6 }}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        {/* Outer glow */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: size * 1.4,
            height: size * 1.4,
            background: `radial-gradient(circle, ${mood.color}22, transparent 70%)`,
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Mid glow ring */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: size * 1.1,
            height: size * 1.1,
            background: `radial-gradient(circle, ${mood.color}15, transparent 70%)`,
          }}
          animate={{ scale: [1.05, 0.95, 1.05] }}
          transition={{ duration: duration * 0.7, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Main orb */}
        <motion.div
          className="relative rounded-full overflow-hidden flex items-center justify-center"
          style={{
            width: size,
            height: size,
            background: `radial-gradient(circle at 35% 35%, ${mood.color}, ${mood.secondaryColor} 60%, ${mood.color}88)`,
            boxShadow: `0 0 ${size * 0.3}px ${mood.color}55, 0 0 ${size * 0.6}px ${mood.color}22`,
          }}
          animate={{ scale: [1, 1.04, 0.97, 1] }}
          transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Highlight shimmer */}
          <motion.div
            className="absolute rounded-full bg-white/20"
            style={{ width: size * 0.28, height: size * 0.28, top: "12%", left: "14%" }}
            animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
            transition={{ duration: duration * 0.6, repeat: Infinity }}
          />

          {/* Emoji */}
          <motion.span
            className="relative z-10 select-none"
            style={{ fontSize: size * 0.34 }}
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
          >
            {mood.emoji}
          </motion.span>
        </motion.div>
      </div>

      {showLabel && (
        <motion.p
          className="font-display font-bold tracking-widest text-sm uppercase"
          style={{ color: mood.color }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          key={mood.key}
        >
          {mood.label}
        </motion.p>
      )}
    </div>
  );
}
