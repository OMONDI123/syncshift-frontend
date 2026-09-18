import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { usePresenceStore } from "@/store/presenceStore";
import { Avatar } from "@/components/common/Avatar";
import { EmptyState } from "@/components/common/EmptyState";
import { formatDistanceToNow } from "date-fns";
import { realtimeClient } from "@/lib/realtime";

export function OnDutyPage() {
  const user = useAuthStore((s) => s.currentUser)!;
  const locations = useScheduleStore((s) =>
    s.locations.filter((l) => user.role === "ADMIN" || user.managedLocationIds.includes(l.id)),
  );
  const staff = useScheduleStore((s) => s.staff);
  const records = usePresenceStore((s) => s.records);
  const [, forceTick] = useState(0);

  // Re-render on presence pub/sub events so this reads as a live board,
  // and tick every 30s so "clocked in Xm ago" stays fresh.
  useEffect(() => {
    const unsubs = locations.map((l) => realtimeClient.subscribe(`presence:${l.id}`, () => forceTick((n) => n + 1)));
    const interval = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => {
      unsubs.forEach((u) => u());
      clearInterval(interval);
    };
  }, [locations]);

  return (
    <AppShell title="On duty now" subtitle="Live clock-in status across the locations you manage">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {locations.map((loc) => {
          const onDuty = records.filter((r) => r.locationId === loc.id && !r.clockOutUtc);
          return (
            <div key={loc.id} className="panel p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-heading text-sm font-semibold text-ink-900">{loc.name}</p>
                <span className="rounded-full bg-signal-greenBg px-2.5 py-0.5 text-xs font-bold text-signal-green">
                  {onDuty.length} on duty
                </span>
              </div>
              {onDuty.length === 0 ? (
                <EmptyState
                  title="No one clocked in"
                  body="Staff clock in from My Shifts once their shift starts — this board updates instantly when they do."
                />
              ) : (
                <ul className="space-y-2">
                  {onDuty.map((r) => {
                    const u = staff.find((s) => s.id === r.userId);
                    if (!u) return null;
                    return (
                      <li key={r.id} className="flex items-center justify-between rounded-card border border-ink-900/10 px-3 py-2">
                        <span className="flex items-center gap-2">
                          <Avatar name={u.name} color={u.avatarColor} size="sm" />
                          <span className="text-sm font-medium text-ink-900">{u.name}</span>
                        </span>
                        <span className="text-xs text-ink-400">
                          clocked in {formatDistanceToNow(new Date(r.clockInUtc), { addSuffix: true })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
