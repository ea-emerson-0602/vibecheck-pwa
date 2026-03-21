"use client";
// src/components/BottomNav.tsx
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/home",    icon: "✨", label: "Vibes"   },
  { href: "/connect", icon: "🔗", label: "Connect" },
  { href: "/history", icon: "📖", label: "History" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <div className="glass border-t border-white/5 px-2 pt-2 pb-6">
        <div className="flex justify-around max-w-sm mx-auto">
          {tabs.map(({ href, icon, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-all duration-200 ${
                  active ? "text-white" : "text-white/30"
                }`}
              >
                <span className="text-xl">{icon}</span>
                <span className={`text-[10px] font-semibold tracking-wider uppercase transition-colors ${
                  active ? "text-purple-400" : "text-white/25"
                }`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
