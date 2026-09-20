import { useState } from "react";
import { toZonedTime } from "date-fns-tz";
import { isSameDay } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSwapStore } from "@/store/swapStore";
import { usePresenceStore } from "@/store/presenceStore";
import { useUiStore } from "@/store/uiStore";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/common/Badge";
import { formatShiftRange } from "@/lib/time";
import type { Location, Shift } from "@/types";
import { Modal } from "@/components/common/Modal";
import { Avatar } from "@/components/common/Avatar";
import { AlertTriangleIcon } from "@/components/icons/Icon";

export function MyShiftsPage() {
  const user = useAuthStore((s) => s.currentUser)!;
  const locationsById = useScheduleStore((s) => s.locationsById);
  const shiftsForUser = useScheduleStore((s) => s.shiftsForUser);
  const staff = useScheduleStore((s) => s.staff);
  const requestSwap = useSwapStore((s) => s.requestSwap);
  const requestDrop = useSwapStore((s) => s.requestDrop);
  const pendingCountFor = useSwapStore((s) => s.pendingCountFor(user.id));
  const showToast = useUiStore((s) => s.showToast);
  const isClockedIn = usePresenceStore((s) => s.isClockedIn);
  const clockIn = usePresenceStore((s) => s.clockIn);
  const clockOut = usePresenceStore((s) => s.clockOut);

  const [swapTarget, setSwapTarget] = useState<Shift | null>(null);

  const myShifts = shiftsForUser(user.id)
    .filter((s) => s.status === "published")
    .sort((a, b) => (a.startUtc < b.startUtc ? -1 : 1));

  const weeklyHours = myShifts.reduce((sum, s) => {
    const hours = (new Date(s.endUtc).getTime() - new Date(s.startUtc).getTime()) / 3_600_000;
    return sum + hours;
  }, 0);

  async function handleDrop(shift: Shift) {
    const result = await requestDrop(shift.id, user.id);
    if (result.success) {
      showToast("success", "Shift offered up for grabs. Qualified coworkers can now pick it up.");
    } else {
      showToast("error", result.reason ?? "Couldn't submit request.");
    }
  }

  /** Compares "today" in the SHIFT's own location timezone, not the
   * browser's — a Miami shift starting at 11pm Eastern is "today" for the
   * person working it even if their device happens to be set to Pacific
   * time. Matches requirement #8's "users see times in the location's
   * timezone" rather than mixing in the viewer's local clock. */
  function isToday(shift: Shift, location: Location) {
    return isSameDay(toZonedTime(new Date(shift.startUtc), location.timezone), toZonedTime(new Date(), location.timezone));
  }

  const eligiblePartners = swapTarget
    ? staff.filter(
        (u) =>
          u.role === "STAFF" &&
          u.id !== user.id &&
          u.skills.includes(swapTarget.skillRequired) &&
          u.certifiedLocationIds.includes(swapTarget.locationId),
      )
    : [];

  async function handleSwapWith(partnerId: string) {
    if (!swapTarget) return;
    const result = await requestSwap(swapTarget.id, user.id, partnerId);
    if (result.success) {
      showToast("success", "Swap request sent. They'll need to accept before a manager reviews it.");
      setSwapTarget(null);
    } else {
      showToast("error", result.reason ?? "Couldn't submit request.");
    }
  }

  return (
    <AppShell title="My shifts" subtitle={`${weeklyHours.toFixed(1)} hours scheduled this week`}>
      {pendingCountFor >= 3 && (
        <p className="mb-4 flex items-center gap-2 rounded-card bg-signal-amberBg px-3 py-2 text-sm text-signal-amber">
          <AlertTriangleIcon size={15} />
          You have 3 pending swap or drop requests — the most allowed at once. Resolve one to request another.
        </p>
      )}

      {myShifts.length === 0 ? (
        <EmptyState title="No shifts yet" body="Once a manager publishes the schedule, your shifts will show up here." />
      ) : (
        <div className="space-y-3">
          {myShifts.map((shift) => {
            const location = locationsById[shift.locationId];
            if (!location) return null;
            const clockedIn = isClockedIn(user.id, shift.id);
            return (
              <div key={shift.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-heading text-sm font-semibold text-ink-900">{location.name}</p>
                  <p className="text-sm text-ink-600">
                    {formatShiftRange(shift, location)} · {shift.skillRequired.replace("_", " ")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {shift.isPremium && <Badge tone="gold">Premium</Badge>}
                  {isToday(shift, location) &&
                    (clockedIn ? (
                      <button
                        className="rounded-card bg-signal-red px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
                        onClick={async () => {
                          const result = await clockOut(user.id, shift.id);
                          showToast(result.success ? "info" : "error", result.success ? "Clocked out." : result.reason ?? "Couldn't clock out.");
                        }}
                      >
                        Clock out
                      </button>
                    ) : (
                      <button
                        className="rounded-card bg-signal-green px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
                        onClick={async () => {
                          const result = await clockIn(user.id, shift.id);
                          showToast(
                            result.success ? "success" : "error",
                            result.success ? "Clocked in — you're now on the On Duty board." : result.reason ?? "Couldn't clock in.",
                          );
                        }}
                      >
                        Clock in
                      </button>
                    ))}
                  <button className="btn-secondary" onClick={() => setSwapTarget(shift)}>
                    Request swap
                  </button>
                  <button className="btn-secondary" onClick={() => handleDrop(shift)}>
                    Drop shift
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {swapTarget && (
        <Modal title="Request a swap" onClose={() => setSwapTarget(null)}>
          <p className="mb-3 text-sm text-ink-600">
            Choose a coworker who's certified and skilled for this shift. They'll need to accept before your manager reviews it —
            your original assignment stays in place until then.
          </p>
          {eligiblePartners.length === 0 ? (
            <p className="text-sm text-ink-400">No qualified coworkers found for this shift's skill and location.</p>
          ) : (
            <ul className="space-y-1.5">
              {eligiblePartners.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => handleSwapWith(p.id)}
                    className="flex w-full items-center gap-2 rounded-card border border-ink-900/10 px-3 py-2 text-left hover:border-gold-500 hover:bg-gold-100/30"
                  >
                    <Avatar name={p.name} color={p.avatarColor} size="sm" />
                    <span className="text-sm font-medium text-ink-900">{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </AppShell>
  );
}
