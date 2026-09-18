import type { ReactNode } from "react";

type Tone = "navy" | "gold" | "green" | "amber" | "red";

const toneStyles: Record<Tone, { bg: string; text: string }> = {
  navy: { bg: "bg-navy-950", text: "text-white" },
  gold: { bg: "bg-gold-100", text: "text-gold-600" },
  green: { bg: "bg-signal-greenBg", text: "text-signal-green" },
  amber: { bg: "bg-signal-amberBg", text: "text-signal-amber" },
  red: { bg: "bg-signal-redBg", text: "text-signal-red" },
};

export function StatCard({
  label,
  value,
  icon,
  tone = "navy",
  hint,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: Tone;
  hint?: string;
}) {
  const styles = toneStyles[tone];
  return (
    <div className="panel flex items-start gap-4 p-5">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-card ${styles.bg} ${styles.text}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
        <p className="mt-1 font-heading text-[26px] font-bold leading-none text-ink-900">{value}</p>
        {hint && <p className="mt-1.5 text-xs text-ink-400">{hint}</p>}
      </div>
    </div>
  );
}
