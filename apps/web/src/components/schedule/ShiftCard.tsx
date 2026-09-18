import type { Location, Shift } from "@/types";
import { formatShiftRange, isOvernightShift } from "@/lib/time";
import { Avatar } from "@/components/common/Avatar";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSettingsStore } from "@/store/settingsStore";
import { MoonIcon } from "@/components/icons/Icon";

export function ShiftCard({
  shift,
  location,
  onClick,
  readOnly,
}: {
  shift: Shift;
  location: Location;
  onClick?: () => void;
  readOnly?: boolean;
}) {
  const staff = useScheduleStore((s) => s.staff);
  const skillColor = useSettingsStore((s) => s.skillColor);
  const skillLabel = useSettingsStore((s) => s.skillLabel);
  const assigned = shift.assignedUserIds.map((id) => staff.find((u) => u.id === id)).filter(Boolean);
  const isFull = shift.assignedUserIds.length >= shift.headcountNeeded;
  const overnight = isOvernightShift(shift, location.timezone);
  const color = skillColor(shift.skillRequired);

  return (
    <button
      onClick={onClick}
      disabled={readOnly}
      className={`group relative w-full overflow-hidden rounded-ticket border border-ink-900/[0.06] bg-white text-left shadow-panel transition-all ${
        readOnly ? "" : "hover:-translate-y-0.5 hover:border-ink-900/10 hover:shadow-lg"
      }`}
    >
      <span className="absolute inset-y-0 left-0 w-[5px]" style={{ backgroundColor: color }} aria-hidden="true" />
      <div className="p-3 pl-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-body text-[13px] font-bold tabular-nums leading-tight text-ink-900">
              {formatShiftRange(shift, location)}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-ink-600">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              {skillLabel(shift.skillRequired)}
            </p>
          </div>
          {shift.isPremium && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-600">
              Premium
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex -space-x-2">
            {assigned.length > 0 ? (
              assigned.map((u) => u && <Avatar key={u.id} name={u.name} color={u.avatarColor} size="sm" />)
            ) : (
              <span className="text-xs italic text-ink-400">Unassigned</span>
            )}
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
              isFull ? "bg-signal-greenBg text-signal-green" : "bg-signal-amberBg text-signal-amber"
            }`}
          >
            {shift.assignedUserIds.length}/{shift.headcountNeeded}
          </span>
        </div>
        {overnight && (
          <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-ink-400">
            <MoonIcon size={11} /> Overnight
          </p>
        )}
      </div>
    </button>
  );
}
