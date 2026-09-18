import { useEffect, useMemo, useState } from "react";
import { startOfWeek } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { Badge } from "@/components/common/Badge";
import { Avatar } from "@/components/common/Avatar";
import { StatCard } from "@/components/common/StatCard";
import { TrendUpIcon, AlertTriangleIcon, ClockIcon } from "@/components/icons/Icon";
import { analyticsApi, type OvertimeEntryDto } from "@/lib/api";

export function OvertimeDashboardPage() {
  const user = useAuthStore((s) => s.currentUser)!;
  const staff = useScheduleStore((s) => s.staff);
  const allLocations = useScheduleStore((s) => s.locations);
  const relevantLocationIds = user.role === "ADMIN" ? allLocations.map((l) => l.id) : user.managedLocationIds;

  const [entries, setEntries] = useState<OvertimeEntryDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 }).toISOString();
    setLoading(true);
    Promise.all(relevantLocationIds.map((id) => analyticsApi.overtime(Number(id), weekStart).catch(() => null))).then(
      (reports) => {
        if (cancelled) return;
        const valid = reports.filter((r): r is NonNullable<typeof r> => r !== null);
        // A staff member working across two of this manager's locations
        // this week would otherwise show up twice — merge by userId.
        const byUser = new Map<string, OvertimeEntryDto>();
        for (const report of valid) {
          for (const e of report.entries) {
            const key = String(e.userId);
            const existing = byUser.get(key);
            if (existing) {
              existing.hoursScheduled += e.hoursScheduled;
              existing.projectedRegularCost = Number(existing.projectedRegularCost) + Number(e.projectedRegularCost);
              existing.projectedOvertimeCost = Number(existing.projectedOvertimeCost) + Number(e.projectedOvertimeCost);
              existing.overWeeklyThreshold = existing.overWeeklyThreshold || e.overWeeklyThreshold;
            } else {
              byUser.set(key, { ...e });
            }
          }
        }
        setEntries([...byUser.values()]);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relevantLocationIds.join(",")]);

  const rows = useMemo(
    () =>
      entries
        .map((e) => ({
          ...e,
          totalCost: Number(e.projectedRegularCost) + Number(e.projectedOvertimeCost),
          status: (e.overWeeklyThreshold ? "over" : e.hoursScheduled >= 35 ? "warning" : "ok") as "over" | "warning" | "ok",
        }))
        .sort((a, b) => b.hoursScheduled - a.hoursScheduled),
    [entries],
  );

  const totalProjectedCost = rows.reduce((sum, r) => sum + r.totalCost, 0);
  const atRiskCount = rows.filter((r) => r.status !== "ok").length;

  return (
    <AppShell title="Overtime & labor compliance" subtitle="Projected hours and cost for this week's schedule, from the live analytics engine">
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Projected labor cost" value={`$${totalProjectedCost.toFixed(0)}`} icon={<TrendUpIcon size={20} />} tone="navy" />
        <StatCard
          label="Staff at or near overtime"
          value={atRiskCount}
          icon={<AlertTriangleIcon size={20} />}
          tone="amber"
          hint={atRiskCount > 0 ? "Review before publishing" : "All clear"}
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
                <th className="px-4 py-3">Hours this week</th>
                <th className="px-4 py-3">Projected cost</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const staffMember = staff.find((u) => u.id === String(r.userId));
                return (
                  <tr key={r.userId} className="border-t border-ink-900/5">
                    <td className="flex items-center gap-2 px-4 py-3">
                      <Avatar name={r.name} color={staffMember?.avatarColor ?? "#6B7280"} size="sm" />
                      <span className="font-medium text-ink-900">{r.name}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-ink-900">{r.hoursScheduled.toFixed(1)}h</td>
                    <td className="px-4 py-3 tabular-nums text-ink-600">${r.totalCost.toFixed(0)}</td>
                    <td className="px-4 py-3">
                      {r.status === "over" && <Badge tone="red">Over threshold</Badge>}
                      {r.status === "warning" && <Badge tone="amber">Approaching threshold</Badge>}
                      {r.status === "ok" && <Badge tone="green">On track</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-ink-400">
        <ClockIcon size={12} className="mr-1 inline" />
        Hard blocks (12h/day, 7th consecutive day) are enforced at the point of assignment on the Schedule board —
        this view is for spotting cumulative weekly risk before it happens. Costs use each person's own hourly rate,
        with hours over the weekly full-time threshold projected at 1.5x.
      </p>
    </AppShell>
  );
}
