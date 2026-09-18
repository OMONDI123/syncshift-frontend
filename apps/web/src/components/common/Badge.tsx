import type { ReactNode } from "react";

type Tone = "neutral" | "gold" | "green" | "amber" | "red" | "navy";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-paper-100 text-ink-600",
  gold: "bg-gold-100 text-gold-600",
  green: "bg-signal-greenBg text-signal-green",
  amber: "bg-signal-amberBg text-signal-amber",
  red: "bg-signal-redBg text-signal-red",
  navy: "bg-navy-950 text-white",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
