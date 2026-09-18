import { useEffect, useState } from "react";
import { CheckIcon, ShuffleIcon, AlertTriangleIcon } from "@/components/icons/Icon";

type Step = 0 | 1 | 2;

const toastCopy: Record<Step, { icon: React.ReactNode; text: string; tone: string }> = {
  0: { icon: <AlertTriangleIcon size={13} />, text: "Sarah called out — 1 shift needs coverage", tone: "bg-signal-amberBg text-signal-amber" },
  1: { icon: <CheckIcon size={13} />, text: "Jordan picked up the open shift", tone: "bg-signal-greenBg text-signal-green" },
  2: { icon: <ShuffleIcon size={13} />, text: "Manager approved Maria ↔ Liam swap", tone: "bg-gold-100 text-gold-600" },
};

const tickets: { id: number; time: string; role: string }[] = [
  { id: 0, time: "7:00 – 11:00 PM", role: "Server · Seattle Harbor" },
  { id: 1, time: "6:00 – 11:00 PM", role: "Bartender · Miami Shore" },
  { id: 2, time: "5:00 – 10:00 PM", role: "Host · Boston Wharf" },
];

function statusFor(ticketId: number, step: Step): { label: string; tone: string; name: string } {
  if (ticketId === 0) {
    if (step === 0) return { label: "Open", tone: "bg-signal-amberBg text-signal-amber", name: "Unassigned" };
    return { label: "Covered", tone: "bg-signal-greenBg text-signal-green", name: "Jordan Blake" };
  }
  if (ticketId === 1) {
    return { label: "Assigned", tone: "bg-signal-greenBg text-signal-green", name: "Liam O'Brien" };
  }
  if (step < 2) return { label: "Swap pending", tone: "bg-gold-100 text-gold-600", name: "Maria Gonzalez" };
  return { label: "Swapped", tone: "bg-signal-greenBg text-signal-green", name: "Liam O'Brien" };
}

export function HeroBoard() {
  const [step, setStep] = useState<Step>(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => ((s + 1) % 3) as Step), 2800);
    return () => clearInterval(id);
  }, []);

  const toast = toastCopy[step];

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-navy-900 shadow-2xl">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-signal-red/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-signal-amber/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-signal-green/70" />
          <span className="ml-3 text-xs font-medium text-white/40">Schedule board · Live</span>
          <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-signal-green">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal-green" /> Live
          </span>
        </div>
        <div className="space-y-2.5 p-4">
          {tickets.map((t) => {
            const status = statusFor(t.id, step);
            return (
              <div key={t.id} className="flex items-center justify-between rounded-ticket border border-white/10 bg-white/[0.04] px-3 py-2.5">
                <div>
                  <p className="text-xs font-bold tabular-nums text-white">{t.time}</p>
                  <p className="text-[11px] text-white/50">{t.role}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-white/80">{status.name}</p>
                  <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${status.tone}`}>
                    {status.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        key={step}
        className={`absolute -bottom-4 left-4 right-4 flex items-center gap-2 rounded-card px-3 py-2 text-xs font-semibold shadow-lg animate-[fadeSlide_0.4s_ease-out] ${toast.tone}`}
      >
        {toast.icon}
        {toast.text}
      </div>
    </div>
  );
}
