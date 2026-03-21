// src/types/index.ts

export type MoodKey =
  | "happy" | "loved" | "calm" | "sad"
  | "anxious" | "tired" | "angry" | "excited";

export interface Mood {
  key: MoodKey;
  label: string;
  emoji: string;
  color: string;
  secondaryColor: string;
  animationDuration: number; // seconds
}

export const MOODS: Mood[] = [
  { key: "happy",   label: "Happy",   emoji: "☀️", color: "#fbbf24", secondaryColor: "#f59e0b", animationDuration: 2 },
  { key: "loved",   label: "Loved",   emoji: "🌸", color: "#f472b6", secondaryColor: "#ec4899", animationDuration: 2.5 },
  { key: "calm",    label: "Calm",    emoji: "🌊", color: "#60a5fa", secondaryColor: "#3b82f6", animationDuration: 4 },
  { key: "sad",     label: "Sad",     emoji: "🌧️", color: "#818cf8", secondaryColor: "#6366f1", animationDuration: 5 },
  { key: "anxious", label: "Anxious", emoji: "⚡", color: "#fb923c", secondaryColor: "#f97316", animationDuration: 0.8 },
  { key: "tired",   label: "Tired",   emoji: "🌙", color: "#a78bfa", secondaryColor: "#8b5cf6", animationDuration: 6 },
  { key: "angry",   label: "Angry",   emoji: "🔥", color: "#f87171", secondaryColor: "#ef4444", animationDuration: 0.6 },
  { key: "excited", label: "Excited", emoji: "✨", color: "#34d399", secondaryColor: "#10b981", animationDuration: 1.2 },
];

export const getMood = (key: MoodKey): Mood =>
  MOODS.find((m) => m.key === key) ?? MOODS[0];

export interface Profile {
  id: string;
  display_name: string;
  partner_code: string;
  partner_id: string | null;
  push_subscription: string | null;
  unmatch_requested: boolean;
}

export interface MoodEntry {
  id: string;
  user_id: string;
  mood: MoodKey;
  note: string;
  created_at: string;
}
