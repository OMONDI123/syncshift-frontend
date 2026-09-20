import { useEffect, useMemo, useState } from "react";
import type { AssignmentCheck, Shift } from "@/types";
import { useScheduleStore } from "@/store/scheduleStore";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import { Modal } from "@/components/common/Modal";
import { Avatar } from "@/components/common/Avatar";
import { ConstraintExplainer } from "@/components/schedule/ConstraintExplainer";
import { formatShiftRange } from "@/lib/time";
import { SearchIcon, AlertTriangleIcon, CheckIcon } from "@/components/icons/Icon";
import { realtimeClient } from "@/lib/realtime";

export function AssignDrawer({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const user = useAuthStore((s) => s.currentUser)!;
  const location = useScheduleStore((s) => s.locationsById[shift.locationId]);
  const staff = useScheduleStore((s) => s.staff);
  const shifts = useScheduleStore((s) => s.shifts);
  const evaluateAssignment = useScheduleStore((s) => s.evaluateAssignment);
  const assignUser = useScheduleStore((s) => s.assignUser);
  const unassignUser = useScheduleStore((s) => s.unassignUser);
  const updateShift = useScheduleStore((s) => s.updateShift);
  const showToast = useUiStore((s) => s.showToast);

  // Version captured when the drawer opened — used to detect a concurrent
  // change made by another manager (the "Simultaneous Assignment" scenario)
  // instead of silently overwriting whatever they just did.
  const [openedVersion] = useState(shift.version);
  const liveShift = shifts.find((s) => s.id === shift.id) ?? shift;
  const staleWarning = liveShift.version !== openedVersion;

  // "Simultaneous Assignment" scenario, third-party-viewer half: the manager
  // whose own request loses a race already sees it via the 409/422 response
  // to their own call (see handleAssign below). This subscription covers
  // anyone else who has this SAME shift's drawer open at the moment another
  // manager's edit or assignment wins the race — the backend pushes to
  // `/topic/shifts/{id}/conflict` specifically so this drawer can say so
  // immediately instead of the person only finding out on their next action.
  useEffect(() => {
    const unsubscribe = realtimeClient.subscribe(`/topic/shifts/${shift.id}/conflict`, (payload) => {
      const message =
        payload && typeof payload === "object" && "message" in payload
          ? String((payload as { message: unknown }).message)
          : "Someone else just changed this shift.";
      showToast("error", message);
    });
    return unsubscribe;
  }, [shift.id, showToast]);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [check, setCheck] = useState<AssignmentCheck | null>(null);
  const [checking, setChecking] = useState(false);

  const candidates = useMemo(
    () =>
      staff
        .filter((u) => u.role === "STAFF")
        .filter((u) => !liveShift.assignedUserIds.includes(u.id))
        .filter((u) => u.name.toLowerCase().includes(query.toLowerCase())),
    [staff, liveShift.assignedUserIds, query],
  );

  // The check hits the backend's real constraint engine, so it's async —
  // re-run it live every time the candidate changes.
  useEffect(() => {
    if (!selectedId) {
      setCheck(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    evaluateAssignment(liveShift.id, selectedId).then((result) => {
      if (!cancelled) {
        setCheck(result);
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, liveShift.id, evaluateAssignment]);

  const blockedBySeventhDayOnly =
    check &&
    !check.ok &&
    check.violations.filter((v) => v.severity === "block").every((v) => v.code === "SEVENTH_CONSECUTIVE_DAY");

  async function handleAssign(override = false) {
    if (!selectedId) return;
    const result = await assignUser(liveShift.id, selectedId, user.id, {
      override,
      overrideReason: override ? overrideReason : undefined,
      expectedVersion: openedVersion,
    });
    if (result.success) {
      showToast("success", "Staff member assigned to shift.");
      setSelectedId(null);
      setOverrideReason("");
    } else if (result.conflict) {
      showToast("error", result.reason ?? "This shift changed since you opened it.");
    } else if (result.unauthorized) {
      showToast("error", result.reason ?? "You don't have permission to do that.");
    } else if (result.check) {
      setCheck(result.check);
    }
  }

  async function handleRemove(userId: string) {
    const result = await unassignUser(liveShift.id, userId, user.id);
    if (result.success) {
      showToast("info", "Assignment removed.");
    } else {
      showToast("error", result.reason ?? "Couldn't remove that assignment.");
    }
  }

  async function handleNudgeLater() {
    const newStart = new Date(new Date(liveShift.startUtc).getTime() + 60 * 60 * 1000).toISOString();
    const newEnd = new Date(new Date(liveShift.endUtc).getTime() + 60 * 60 * 1000).toISOString();
    const result = await updateShift(liveShift.id, { startUtc: newStart, endUtc: newEnd, version: liveShift.version }, user.id);
    if (result.success) {
      showToast("info", "Shift time updated. Any pending swap on this shift was cancelled and everyone was notified.");
    } else {
      showToast("error", result.reason ?? "Couldn't update that shift.");
    }
  }

  if (!location) return null;

  return (
    <Modal title="Manage shift" onClose={onClose}>
      <div className="space-y-5">
        {staleWarning && (
          <div className="flex items-start gap-2 rounded-card border border-signal-amber/30 bg-signal-amberBg px-3 py-2.5 text-sm text-signal-amber">
            <AlertTriangleIcon size={16} className="mt-0.5 shrink-0" />
            <span>
              Someone else just changed this shift while you had it open. The assignment list below reflects the
              latest state — review it before making another change.
            </span>
          </div>
        )}

        <div className="rounded-card bg-paper-50 p-3">
          <p className="font-heading text-sm font-semibold text-ink-900">{location.name}</p>
          <p className="text-sm text-ink-600">
            {formatShiftRange(liveShift, location)} · {liveShift.skillRequired.replace("_", " ")}
          </p>
          <button onClick={handleNudgeLater} className="mt-2 text-xs font-semibold text-navy-800 hover:underline">
            Move shift 1 hour later
          </button>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-900">
            Assigned ({liveShift.assignedUserIds.length}/{liveShift.headcountNeeded})
          </p>
          {liveShift.assignedUserIds.length === 0 ? (
            <p className="text-sm text-ink-400">No one assigned yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {liveShift.assignedUserIds.map((id) => {
                const u = staff.find((s) => s.id === id);
                if (!u) return null;
                return (
                  <li key={id} className="flex items-center justify-between rounded-card border border-ink-900/10 px-3 py-2">
                    <span className="flex items-center gap-2">
                      <Avatar name={u.name} color={u.avatarColor} size="sm" />
                      <span className="text-sm font-medium text-ink-900">{u.name}</span>
                    </span>
                    <button onClick={() => handleRemove(id)} className="text-xs font-semibold text-signal-red hover:underline">
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-ink-900" htmlFor="staff-search">
            Assign someone
          </label>
          <div className="relative">
            <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              id="staff-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedId(null);
              }}
              placeholder="Search staff by name…"
              className="w-full rounded-card border border-ink-900/15 py-2 pl-9 pr-3 text-sm focus:border-gold-500"
            />
          </div>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {candidates.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-center gap-2 rounded-card px-2 py-1.5 text-left text-sm transition hover:bg-paper-50 ${
                    selectedId === c.id ? "bg-gold-100" : ""
                  }`}
                >
                  <Avatar name={c.name} color={c.avatarColor} size="sm" />
                  {c.name}
                  {selectedId === c.id && <CheckIcon size={14} className="ml-auto text-gold-600" />}
                  {selectedId !== c.id && <span className="ml-auto text-xs text-ink-400">{c.skills.join(", ")}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {checking && <p className="text-xs text-ink-400">Checking the schedule…</p>}

        {check && (
          <div>
            <ConstraintExplainer check={check} onPickSuggestion={(id) => setSelectedId(id)} />
            <div className="mt-3 flex items-center gap-2">
              <button className="btn-primary" disabled={!check.ok} onClick={() => handleAssign(false)}>
                Confirm assignment
              </button>
              {blockedBySeventhDayOnly && <span className="text-xs text-ink-600">or override below</span>}
            </div>
            {blockedBySeventhDayOnly && (
              <div className="mt-3 rounded-card border border-signal-amber/40 bg-signal-amberBg p-3">
                <label className="mb-1 block text-xs font-semibold text-ink-900" htmlFor="override-reason">
                  Manager override reason (required)
                </label>
                <textarea
                  id="override-reason"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={2}
                  className="w-full rounded-card border border-ink-900/15 px-3 py-2 text-sm"
                  placeholder="e.g. Covering a call-out, staff member volunteered."
                />
                <button className="btn-danger mt-2" disabled={!overrideReason.trim()} onClick={() => handleAssign(true)}>
                  Assign with documented override
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
