import { useEffect, useMemo, useState } from "react";
import { subDays } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { Avatar } from "@/components/common/Avatar";
import { Badge } from "@/components/common/Badge";
import { StatCard } from "@/components/common/StatCard";
import { ScaleIcon } from "@/components/icons/Icon";
import { analyticsApi, type DistributionEntryDto } from "@/lib/api";

const PERIOD_DAYS = 90;

interface Row {
  userId: string;
  name: string;
  hours: number;
  desired: number | null;
  premiumAssigned: number;
  shiftCount: number;
}

export function FairnessPage() {
  const user = useAuthStore((s) => s.currentUser)!;
  const staff = useScheduleStore((s) => s.staff);
  const allLocations = useScheduleStore((s) => s.locations);
  const relevantLocationIds = user.role === "ADMIN" ? allLocations.map((l) => l.id) : user.managedLocationIds;

  const [entries, setEntries] = useState<DistributionEntryDto[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const to = new Date().toISOString();
    const from = subDays(new Date(), PERIOD_DAYS).toISOString();
    setLoading(true);
    Promise.all(relevantLocationIds.map((id) => analyticsApi.distribution(Number(id), from, to).catch(() => null))).then(
      (reports) => {
        if (cancelled) return;
        const valid = reports.filter((r): r is NonNullable<typeof r> => r !== null);
        setEntries(valid.flatMap((r) => r.entries));
        setScores(valid.map((r) => r.fairnessScore));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relevantLocationIds.join(",")]);

  const rows = useMemo<Row[]>(() => {
    const byUser = new Map<string, Row>();
    for (const e of entries) {
      const userId = String(e.userId);
      const existing = byUser.get(userId);
      if (existing) {
        existing.hours += e.hoursWorked;
        existing.premiumAssigned += e.premiumShiftsWorked;
        existing.shiftCount += e.totalShiftsWorked;
      } else {
        byUser.set(userId, {
          userId,
          name: e.name,
          hours: e.hoursWorked,
          desired: e.desiredWeeklyHours,
          premiumAssigned: e.premiumShiftsWorked,
          shiftCount: e.totalShiftsWorked,
        });
      }
    }
    return [...byUser.values()].filter((r) => r.shiftCount > 0).sort((a, b) => b.premiumAssigned - a.premiumAssigned);
  }, [entries]);

  const maxPremium = Math.max(1, ...rows.map((r) => r.premiumAssigned));
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 100;

  return (
    <AppShell
      title="Fairness report"
      subtitle={`Hours distribution and premium (Fri/Sat evening) shift equity — last ${PERIOD_DAYS} days`}
    >
      <div className="mb-6 max-w-xs">
        <StatCard
          label="Fairness score"
          value={avgScore.toFixed(0)}
          icon={<ScaleIcon size={20} />}
          tone={avgScore >= 80 ? "green" : avgScore >= 50 ? "amber" : "red"}
          hint="100 minus the variation in premium shifts across staff — higher is more even"
        />
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper-100 text-xs font-semibold uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Hours this period</th>
                <th className="px-4 py-3">Desired hours (weekly)</th>
                <th className="px-4 py-3">Premium shifts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const staffMember = staff.find((u) => u.id === r.userId);
                return (
                  <tr key={r.userId} className="border-t border-ink-900/5">
                    <td className="flex items-center gap-2 px-4 py-3">
                      <Avatar name={r.name} color={staffMember?.avatarColor ?? "#6B7280"} size="sm" />
                      <span className="font-medium text-ink-900">{r.name}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-ink-900">{r.hours.toFixed(1)}h</td>
                    <td className="px-4 py-3 tabular-nums text-ink-600">
                      {r.desired !== null ? (
                        <Badge tone="neutral">{r.desired}h/wk</Badge>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-paper-100">
                          <div className="h-full bg-gold-500" style={{ width: `${(r.premiumAssigned / maxPremium) * 100}%` }} />
                        </div>
                        <span className="tabular-nums text-ink-600">{r.premiumAssigned}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-ink-400">
        Pulled live from the assignment engine's fairness analytics — sort by premium shifts to see exactly how
        Friday/Saturday evenings have been distributed, and use the score above as a single-number answer to a
        fairness complaint.
      </p>
    </AppShell>
  );
}
