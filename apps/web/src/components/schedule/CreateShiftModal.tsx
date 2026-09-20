import { useState } from "react";
import { fromZonedTime } from "date-fns-tz";
import { Modal } from "@/components/common/Modal";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";
import type { Location } from "@/types";

/** Requirement #2: "Managers must be able to: Create shifts with location,
 * date/time, required skill, and headcount needed." This was the single
 * biggest gap found in review — the backend (`POST /shifts`) and the store
 * action (`createShift`) both already worked; nothing in the UI ever called
 * either. This modal is that missing call site.
 *
 * Date/time is entered in the shift's own LOCATION timezone (displayed
 * explicitly below the fields) and converted to UTC with `fromZonedTime`
 * before hitting the API — same pattern as `data/seed.ts` — so a manager
 * scheduling a Miami shift from a Seattle browser still gets the time they
 * typed, not a silently-reinterpreted one. */
export function CreateShiftModal({
  location,
  initialDate,
  onClose,
  onCreated,
}: {
  location: Location;
  initialDate?: string;
  onClose: () => void;
  /** Called with the new shift's id right after a successful create, before
   * onClose — lets the caller chain straight into assigning staff. */
  onCreated?: (shiftId: string) => void;
}) {
  const createShift = useScheduleStore((s) => s.createShift);
  const skills = useSettingsStore((s) => s.skills);
  const showToast = useUiStore((s) => s.showToast);

  const [date, setDate] = useState(initialDate ?? "");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [skillId, setSkillId] = useState(skills[0]?.id ?? "");
  const [headcount, setHeadcount] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!date) return setError("Pick a date.");
    if (!skillId) return setError("Pick a required skill.");
    if (headcount < 1) return setError("Headcount must be at least 1.");

    const startLocal = new Date(`${date}T${startTime}:00`);
    let endLocal = new Date(`${date}T${endTime}:00`);
    // An end time earlier than the start time means an overnight shift
    // (e.g. 11pm–3am) — roll the end date forward a day rather than reject
    // it, matching requirement #8's "single shift, handled as overnight".
    if (endLocal <= startLocal) endLocal = new Date(endLocal.getTime() + 24 * 60 * 60 * 1000);

    const startUtc = fromZonedTime(startLocal, location.timezone).toISOString();
    const endUtc = fromZonedTime(endLocal, location.timezone).toISOString();

    setSaving(true);
    const result = await createShift(
      { locationId: location.id, skillRequired: skillId, headcountNeeded: headcount, startUtc, endUtc, notes: notes || undefined },
      "",
    );
    setSaving(false);

    if (result.success) {
      showToast("success", "Shift created as a draft — now assign staff so publishing actually notifies someone.");
      if (result.shiftId) onCreated?.(result.shiftId);
      onClose();
    } else {
      setError(result.reason ?? "Couldn't create that shift.");
    }
  }

  return (
    <Modal
      title={`New shift at ${location.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={saving} onClick={handleSubmit}>
            {saving ? "Creating…" : "Create shift"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-ink-400">
          Times are in {location.name}'s timezone ({location.timezone}). New shifts start as drafts — publish the
          week once you're happy with the schedule.
        </p>

        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-900" htmlFor="shift-date">
            Date
          </label>
          <input
            id="shift-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-card border border-ink-900/15 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-900" htmlFor="shift-start">
              Start time
            </label>
            <input
              id="shift-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-card border border-ink-900/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-900" htmlFor="shift-end">
              End time
            </label>
            <input
              id="shift-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-card border border-ink-900/15 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-ink-400">Earlier than start = overnight, ends next day.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-900" htmlFor="shift-skill">
              Required skill
            </label>
            <select
              id="shift-skill"
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
              className="w-full rounded-card border border-ink-900/15 px-3 py-2 text-sm"
            >
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-900" htmlFor="shift-headcount">
              Headcount needed
            </label>
            <input
              id="shift-headcount"
              type="number"
              min={1}
              value={headcount}
              onChange={(e) => setHeadcount(Number(e.target.value))}
              className="w-full rounded-card border border-ink-900/15 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-900" htmlFor="shift-notes">
            Notes (optional)
          </label>
          <textarea
            id="shift-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-card border border-ink-900/15 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="rounded-card bg-signal-redBg px-3 py-2 text-sm text-signal-red">{error}</p>}
      </div>
    </Modal>
  );
}
