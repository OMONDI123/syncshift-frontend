import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSwapStore } from "@/store/swapStore";
import { useUiStore } from "@/store/uiStore";
import { EmptyState } from "@/components/common/EmptyState";
import { Avatar } from "@/components/common/Avatar";
import { CheckIcon, XIcon } from "@/components/icons/Icon";
import { formatShiftRange } from "@/lib/time";

/** Requirement #3's manager-approval half of the swap/drop workflow. This
 * used to live only as a banner on the Schedule board that rendered NOTHING
 * — not even an empty state — whenever there was nothing pending, which
 * made it easy to miss that the feature existed at all. This page is the
 * same underlying data and actions (pendingApprovalsFor, managerApprove,
 * managerReject), just always visible with a proper nav entry and empty
 * state, so "how do I approve a swap" has an obvious answer. The
 * Schedule-board banner still shows too when something's pending, as a
 * convenience for managers already looking at that page. */
export function SwapApprovalsPage() {
  const user = useAuthStore((s) => s.currentUser)!;
  const locations = useScheduleStore((s) =>
    s.locations.filter((l) => user.role === "ADMIN" || user.managedLocationIds.includes(l.id)),
  );
  const shifts = useScheduleStore((s) => s.shifts);
  const staff = useScheduleStore((s) => s.staff);
  const locationsById = useScheduleStore((s) => s.locationsById);
  const approvalLocationIds = user.role === "ADMIN" ? locations.map((l) => l.id) : user.managedLocationIds;
  const pendingApprovals = useSwapStore((s) => s.pendingApprovalsFor(approvalLocationIds));
  const managerApprove = useSwapStore((s) => s.managerApprove);
  const managerReject = useSwapStore((s) => s.managerReject);
  const showToast = useUiStore((s) => s.showToast);

  async function handleApprove(swapId: string) {
    const result = await managerApprove(swapId, user.id);
    if (result.success) showToast("success", "Swap approved and schedule updated.");
    else showToast("error", result.reason ?? "Couldn't approve that request.");
  }

  async function handleReject(swapId: string) {
    const reason = window.prompt("Reason for rejecting this request (staff will see this):");
    if (reason === null) return; // cancelled
    const result = await managerReject(swapId, user.id, reason || "Doesn't work with current coverage needs.");
    if (result.success) showToast("info", "Request rejected.");
    else showToast("error", result.reason ?? "Couldn't reject that request.");
  }

  return (
    <AppShell
      title="Swap approvals"
      subtitle="Every swap and drop pickup waiting on a manager, across the locations you run"
    >
      {pendingApprovals.length === 0 ? (
        <EmptyState
          title="Nothing waiting on you"
          body="When a staff swap or dropped-shift pickup is ready for approval, it'll show up here — and on the Schedule board — immediately."
        />
      ) : (
        <div className="space-y-3">
          {pendingApprovals.map((swap) => {
            const swapShift = shifts.find((s) => s.id === swap.shiftId);
            const swapLocation = swapShift ? locationsById[swapShift.locationId] : undefined;
            const requester = staff.find((u) => u.id === swap.requestedByUserId);
            const partner = swap.partnerUserId ? staff.find((u) => u.id === swap.partnerUserId) : undefined;

            return (
              <div key={swap.id} className="panel flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {requester && <Avatar name={requester.name} color={requester.avatarColor} size="sm" />}
                    <span className="text-sm font-medium text-ink-900">{requester?.name ?? "Unknown"}</span>
                  </div>
                  <span className="rounded-full bg-ink-900/5 px-2 py-0.5 text-xs font-semibold text-ink-600">
                    {swap.kind === "swap" ? "Swap request" : "Dropped shift"}
                  </span>
                  {swap.kind === "swap" && (
                    <>
                      <span className="text-ink-400">↔</span>
                      <div className="flex items-center gap-2">
                        {partner && <Avatar name={partner.name} color={partner.avatarColor} size="sm" />}
                        <span className="text-sm font-medium text-ink-900">{partner?.name ?? "—"}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="text-sm text-ink-600">
                  {swapLocation && <span className="font-medium text-ink-900">{swapLocation.name}</span>}
                  {swapShift && swapLocation && <span className="ml-2">{formatShiftRange(swapShift, swapLocation)}</span>}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(swap.id)}
                    className="flex items-center gap-1 rounded-card bg-signal-green px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    <CheckIcon size={13} /> Approve
                  </button>
                  <button
                    onClick={() => handleReject(swap.id)}
                    className="flex items-center gap-1 rounded-card border border-ink-900/10 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-paper-100"
                  >
                    <XIcon size={13} /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
