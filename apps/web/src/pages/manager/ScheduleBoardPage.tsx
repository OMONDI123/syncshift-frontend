import { useMemo, useState } from "react";
import { addDays, startOfWeek } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSwapStore } from "@/store/swapStore";
import { useUiStore } from "@/store/uiStore";
import { ShiftCard } from "@/components/schedule/ShiftCard";
import { AssignDrawer } from "@/components/schedule/AssignDrawer";
import { CreateShiftModal } from "@/components/schedule/CreateShiftModal";
import type { Shift } from "@/types";
import { AlertTriangleIcon, CheckIcon, XIcon, PlusIcon } from "@/components/icons/Icon";
import { Avatar } from "@/components/common/Avatar";
import { formatShiftRange } from "@/lib/time";

const PUBLISH_CUTOFF_HOURS = 48;

export function ScheduleBoardPage() {
  const user = useAuthStore((s) => s.currentUser)!;
  const locations = useScheduleStore((s) =>
    s.locations.filter((l) => user.role === "ADMIN" || user.managedLocationIds.includes(l.id)),
  );
  const shifts = useScheduleStore((s) => s.shifts);
  const publishLocationWeek = useScheduleStore((s) => s.publishLocationWeek);
  const showToast = useUiStore((s) => s.showToast);
  const staff = useScheduleStore((s) => s.staff);
  const locationsById = useScheduleStore((s) => s.locationsById);
  const approvalLocationIds = user.role === "ADMIN" ? locations.map((l) => l.id) : user.managedLocationIds;
  const pendingApprovals = useSwapStore((s) => s.pendingApprovalsFor(approvalLocationIds));
  const managerApprove = useSwapStore((s) => s.managerApprove);
  const managerReject = useSwapStore((s) => s.managerReject);

  const [activeLocationId, setActiveLocationId] = useState(locations[0]?.id);
  const [openShift, setOpenShift] = useState<Shift | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPrefillDate, setCreatePrefillDate] = useState<string | undefined>(undefined);

  const location = locations.find((l) => l.id === activeLocationId) ?? locations[0];

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const locationShifts = useMemo(
    () => shifts.filter((s) => s.locationId === location?.id).sort((a, b) => (a.startUtc < b.startUtc ? -1 : 1)),
    [shifts, location?.id],
  );

  function shiftsForDay(day: Date) {
    if (!location) return [];
    return locationShifts.filter((s) => {
      const zoned = toZonedTime(new Date(s.startUtc), location.timezone);
      return zoned.toDateString() === day.toDateString();
    });
  }

  const understaffedCount = locationShifts.filter((s) => s.assignedUserIds.length < s.headcountNeeded).length;

  function openCreateForDay(day: Date) {
    setCreatePrefillDate(formatInTimeZone(day, location.timezone, "yyyy-MM-dd"));
    setShowCreateModal(true);
  }

  async function handlePublish() {
    if (!location) return;
    const draftShifts = locationShifts.filter((s) => s.status === "draft");
    const unassignedCount = draftShifts.filter((s) => s.assignedUserIds.length === 0).length;
    if (unassignedCount > 0) {
      const proceed = window.confirm(
        `${unassignedCount} of the shifts you're about to publish ${unassignedCount === 1 ? "has" : "have"} nobody assigned yet. ` +
          `Nobody will be notified for those, and no one will be able to clock in until you assign staff. Publish anyway?`,
      );
      if (!proceed) return;
    }
    const result = await publishLocationWeek(location.id, user.id);
    if (result.success) {
      showToast("success", `${location.name}'s schedule was published. Staff have been notified.`);
    } else {
      showToast("error", result.reason ?? "Couldn't publish this schedule.");
    }
  }

  if (!location) {
    return (
      <AppShell title="Schedule board">
        <p className="text-sm text-ink-600">You don't manage any locations yet.</p>
      </AppShell>
    );
  }

  async function handleApprove(swapId: string) {
    const result = await managerApprove(swapId, user.id);
    if (result.success) showToast("success", "Swap approved and schedule updated.");
    else showToast("error", result.reason ?? "Couldn't approve that request.");
  }

  async function handleReject(swapId: string) {
    const result = await managerReject(swapId, user.id, "Doesn't work with current coverage needs.");
    if (result.success) showToast("info", "Request rejected.");
    else showToast("error", result.reason ?? "Couldn't reject that request.");
  }

  return (
    <AppShell title="Schedule board" subtitle="This week · click any shift to assign or edit staff">
      {pendingApprovals.length > 0 && (
        <div className="mb-5 rounded-card border border-gold-500/30 bg-gold-100/40 p-4">
          <p className="mb-2 font-heading text-sm font-semibold text-ink-900">
            {pendingApprovals.length} swap{pendingApprovals.length > 1 ? "s" : ""} waiting on your approval
          </p>
          <div className="space-y-2">
            {pendingApprovals.map((swap) => {
              const swapShift = shifts.find((s) => s.id === swap.shiftId);
              const swapLocation = swapShift ? locationsById[swapShift.locationId] : undefined;
              const requester = staff.find((u) => u.id === swap.requestedByUserId);
              const partner = staff.find((u) => u.id === swap.partnerUserId);
              return (
                <div key={swap.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-white px-3 py-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    {requester && <Avatar name={requester.name} color={requester.avatarColor} size="sm" />}
                    <span className="font-medium text-ink-900">{requester?.name}</span>
                    <span className="text-ink-400">{swap.kind === "swap" ? "↔" : "→"}</span>
                    {partner && <Avatar name={partner.name} color={partner.avatarColor} size="sm" />}
                    <span className="font-medium text-ink-900">{partner?.name ?? "—"}</span>
                    <span className="ml-2 text-ink-400">
                      {swapShift && swapLocation && formatShiftRange(swapShift, swapLocation)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(swap.id)}
                      className="flex items-center gap-1 rounded-card bg-signal-green px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      <CheckIcon size={13} /> Approve
                    </button>
                    <button
                      onClick={() => handleReject(swap.id)}
                      className="flex items-center gap-1 rounded-card border border-ink-900/10 px-2.5 py-1.5 text-xs font-semibold text-ink-600 hover:bg-paper-100"
                    >
                      <XIcon size={13} /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 rounded-card bg-paper-100 p-1">
          {locations.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveLocationId(l.id)}
              className={`rounded-card px-3 py-1.5 text-sm font-semibold transition ${
                l.id === location.id ? "bg-navy-950 text-white shadow-sm" : "text-ink-600 hover:text-ink-900"
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {understaffedCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-signal-amber">
              <AlertTriangleIcon size={15} />
              {understaffedCount} shift{understaffedCount > 1 ? "s" : ""} need coverage
            </span>
          )}
          <button className="btn-secondary" onClick={() => { setCreatePrefillDate(undefined); setShowCreateModal(true); }}>
            <PlusIcon size={14} /> Add shift
          </button>
          <button className="btn-primary" onClick={handlePublish}>
            Publish this week
          </button>
        </div>
      </div>

      <p className="mb-4 text-xs text-ink-400">
        Edits after publishing are allowed up until {PUBLISH_CUTOFF_HOURS} hours before a shift starts. Timezone: {location.timezone}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((day) => (
          <div key={day.toISOString()} className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
              {day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </p>
            <div className="space-y-2">
              {shiftsForDay(day).length === 0 ? (
                <button
                  onClick={() => openCreateForDay(day)}
                  className="w-full rounded-ticket border border-dashed border-ink-900/10 px-2 py-4 text-center text-xs text-ink-400 transition hover:border-gold-500 hover:text-gold-600"
                >
                  No shifts · <span className="underline">+ Add</span>
                </button>
              ) : (
                <>
                  {shiftsForDay(day).map((shift) => (
                    <ShiftCard key={shift.id} shift={shift} location={location} onClick={() => setOpenShift(shift)} />
                  ))}
                  <button
                    onClick={() => openCreateForDay(day)}
                    className="flex w-full items-center justify-center gap-1 rounded-ticket border border-dashed border-ink-900/10 px-2 py-1.5 text-xs text-ink-400 transition hover:border-gold-500 hover:text-gold-600"
                  >
                    <PlusIcon size={12} /> Add another
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {openShift && (
        <AssignDrawer
          shift={shifts.find((s) => s.id === openShift.id) ?? openShift}
          onClose={() => setOpenShift(null)}
        />
      )}

      {showCreateModal && (
        <CreateShiftModal
          location={location}
          initialDate={createPrefillDate}
          onClose={() => setShowCreateModal(false)}
          onCreated={(shiftId) => {
            const created = useScheduleStore.getState().shifts.find((s) => s.id === shiftId);
            if (created) setOpenShift(created);
          }}
        />
      )}
    </AppShell>
  );
}
