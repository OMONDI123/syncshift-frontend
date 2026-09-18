import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSwapStore } from "@/store/swapStore";
import { useUiStore } from "@/store/uiStore";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/common/Badge";
import { formatShiftRange } from "@/lib/time";
import type { SwapStatus } from "@/types";
import { ShuffleIcon, CalendarIcon } from "@/components/icons/Icon";

const statusTone: Record<SwapStatus, "neutral" | "gold" | "green" | "amber" | "red" | "navy"> = {
  open: "gold",
  pending_partner: "amber",
  pending_manager: "amber",
  approved: "green",
  rejected: "red",
  cancelled: "neutral",
  expired: "neutral",
};

const statusLabel: Record<SwapStatus, string> = {
  open: "Up for grabs",
  pending_partner: "Waiting on partner",
  pending_manager: "Waiting on manager",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  expired: "Expired",
};

export function MarketplacePage() {
  const user = useAuthStore((s) => s.currentUser)!;
  const shifts = useScheduleStore((s) => s.shifts);
  const locationsById = useScheduleStore((s) => s.locationsById);
  const swaps = useSwapStore((s) => s.swaps);
  const pickUpDrop = useSwapStore((s) => s.pickUpDrop);
  const partnerAccept = useSwapStore((s) => s.partnerAccept);
  const requesterCancel = useSwapStore((s) => s.requesterCancel);
  const showToast = useUiStore((s) => s.showToast);

  const openDrops = swaps.filter((s) => {
    if (s.status !== "open" || s.kind !== "drop") return false;
    const shift = shifts.find((sh) => sh.id === s.shiftId);
    if (!shift) return false;
    return shift.skillRequired && user.skills.includes(shift.skillRequired) && user.certifiedLocationIds.includes(shift.locationId);
  });

  const swapsAwaitingMe = swaps.filter((s) => s.kind === "swap" && s.status === "pending_partner" && s.partnerUserId === user.id);

  const myRequests = swaps.filter((s) => s.requestedByUserId === user.id);

  async function handlePickUp(swapId: string) {
    const result = await pickUpDrop(swapId, user.id);
    showToast(result.success ? "success" : "error", result.success ? "You picked up the shift. Waiting on manager approval." : result.reason ?? "Couldn't pick up that shift.");
  }

  async function handleAccept(swapId: string) {
    const result = await partnerAccept(swapId);
    showToast(result.success ? "success" : "error", result.success ? "Swap accepted. Waiting on manager approval." : result.reason ?? "Couldn't accept that swap.");
  }

  async function handleCancel(swapId: string) {
    const result = await requesterCancel(swapId);
    showToast(result.success ? "info" : "error", result.success ? "Request cancelled. Your original shift is unchanged." : result.reason ?? "Couldn't cancel that request.");
  }

  return (
    <AppShell title="Marketplace" subtitle="Pick up open shifts and manage swap requests">
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 font-heading text-base font-semibold text-ink-900">
          <CalendarIcon size={17} className="text-ink-400" /> Open shifts you're qualified for
        </h2>
        {openDrops.length === 0 ? (
          <EmptyState title="Nothing open right now" body="When a coworker drops a shift you're qualified for, it'll show up here." />
        ) : (
          <div className="space-y-2">
            {openDrops.map((s) => {
              const shift = shifts.find((sh) => sh.id === s.shiftId)!;
              const location = locationsById[shift.locationId];
              return (
                <div key={s.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-heading text-sm font-semibold text-ink-900">{location?.name}</p>
                    <p className="text-sm text-ink-600">
                      {location && formatShiftRange(shift, location)} · {shift.skillRequired.replace("_", " ")}
                    </p>
                  </div>
                  <button className="btn-primary" onClick={() => handlePickUp(s.id)}>
                    Pick up shift
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 font-heading text-base font-semibold text-ink-900">
          <ShuffleIcon size={17} className="text-ink-400" /> Swap requests for you
        </h2>
        {swapsAwaitingMe.length === 0 ? (
          <EmptyState title="No swap requests" body="When a coworker asks to swap a shift with you, it'll appear here." />
        ) : (
          <div className="space-y-2">
            {swapsAwaitingMe.map((s) => {
              const shift = shifts.find((sh) => sh.id === s.shiftId)!;
              const location = locationsById[shift.locationId];
              return (
                <div key={s.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-heading text-sm font-semibold text-ink-900">{location?.name}</p>
                    <p className="text-sm text-ink-600">{location && formatShiftRange(shift, location)}</p>
                  </div>
                  <button className="btn-primary" onClick={() => handleAccept(s.id)}>
                    Accept swap
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-heading text-base font-semibold text-ink-900">Your requests</h2>
        {myRequests.length === 0 ? (
          <p className="text-sm text-ink-400">You haven't requested any swaps or drops.</p>
        ) : (
          <div className="space-y-2">
            {myRequests.map((s) => {
              const shift = shifts.find((sh) => sh.id === s.shiftId);
              const location = shift ? locationsById[shift.locationId] : undefined;
              const cancellable = s.status === "pending_partner" || s.status === "pending_manager" || s.status === "open";
              return (
                <div key={s.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-heading text-sm font-semibold text-ink-900">
                      {s.kind === "swap" ? "Swap" : "Drop"} · {location?.name}
                    </p>
                    <p className="text-sm text-ink-600">{shift && location && formatShiftRange(shift, location)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone[s.status]}>{statusLabel[s.status]}</Badge>
                    {cancellable && (
                      <button className="text-xs font-semibold text-signal-red hover:underline" onClick={() => handleCancel(s.id)}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
