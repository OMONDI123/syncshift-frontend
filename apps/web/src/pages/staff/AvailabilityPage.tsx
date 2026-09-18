import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";
import { useAvailabilityStore } from "@/store/availabilityStore";
import { useUiStore } from "@/store/uiStore";
import { XIcon } from "@/components/icons/Icon";
import { format } from "date-fns";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minutesToTimeInput(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
function timeInputToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function AvailabilityPage() {
  const user = useAuthStore((s) => s.currentUser)!;
  const windows = useAvailabilityStore((s) => s.forUser(user.id));
  const setRecurring = useAvailabilityStore((s) => s.setRecurring);
  const clearRecurring = useAvailabilityStore((s) => s.clearRecurring);
  const addException = useAvailabilityStore((s) => s.addException);
  const removeException = useAvailabilityStore((s) => s.removeException);
  const showToast = useUiStore((s) => s.showToast);

  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionAvailable, setExceptionAvailable] = useState(false);

  const recurringByDay = Object.fromEntries(
    DAY_LABELS.map((_, dow) => [dow, windows.find((w) => w.type === "recurring" && w.dayOfWeek === dow)]),
  );
  const exceptions = windows.filter((w) => w.type === "exception").sort((a, b) => (a.date! < b.date! ? -1 : 1));

  function handleToggle(dow: number, enabled: boolean) {
    if (enabled) {
      setRecurring(user.id, dow, 9 * 60, 17 * 60, user.id);
    } else {
      clearRecurring(user.id, dow, user.id);
    }
    showToast("success", "Availability updated.");
  }

  function handleTimeChange(dow: number, field: "start" | "end", value: string) {
    const existing = recurringByDay[dow];
    const start = field === "start" ? timeInputToMinutes(value) : existing?.startMinutes ?? 9 * 60;
    const end = field === "end" ? timeInputToMinutes(value) : existing?.endMinutes ?? 17 * 60;
    setRecurring(user.id, dow, start, end, user.id);
  }

  function handleAddException() {
    if (!exceptionDate) return;
    addException(user.id, exceptionDate, exceptionAvailable, user.id);
    showToast("success", `${exceptionAvailable ? "Marked available" : "Marked unavailable"} for ${exceptionDate}.`);
    setExceptionDate("");
  }

  return (
    <AppShell title="My availability" subtitle="Set your recurring weekly hours, plus one-off exceptions">
      <div className="panel mb-6 p-5">
        <p className="mb-1 font-heading text-sm font-semibold text-ink-900">Recurring weekly availability</p>
        <p className="mb-4 text-xs text-ink-400">
          Times are in your own local timezone — the schedule engine converts them for each location automatically,
          so this stays correct even if you're certified somewhere in a different timezone.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {DAY_LABELS.map((label, dow) => {
            const window = recurringByDay[dow];
            const enabled = !!window;
            return (
              <div key={dow} className={`rounded-card border p-3 ${enabled ? "border-gold-500/40 bg-gold-100/20" : "border-ink-900/10"}`}>
                <label className="flex items-center justify-between text-sm font-semibold text-ink-900">
                  {label}
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => handleToggle(dow, e.target.checked)}
                    className="h-4 w-4 accent-gold-500"
                  />
                </label>
                {enabled && window && (
                  <div className="mt-2 space-y-1.5">
                    <input
                      type="time"
                      value={minutesToTimeInput(window.startMinutes)}
                      onChange={(e) => handleTimeChange(dow, "start", e.target.value)}
                      className="w-full rounded-card border border-ink-900/15 px-2 py-1 text-xs"
                    />
                    <input
                      type="time"
                      value={minutesToTimeInput(window.endMinutes)}
                      onChange={(e) => handleTimeChange(dow, "end", e.target.value)}
                      className="w-full rounded-card border border-ink-900/15 px-2 py-1 text-xs"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel p-5">
        <p className="mb-1 font-heading text-sm font-semibold text-ink-900">One-off exceptions</p>
        <p className="mb-4 text-xs text-ink-400">
          Override a specific date — e.g. mark yourself unavailable for a doctor's appointment, or available on a day
          you'd normally be off.
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-900" htmlFor="exception-date">
              Date
            </label>
            <input
              id="exception-date"
              type="date"
              value={exceptionDate}
              onChange={(e) => setExceptionDate(e.target.value)}
              className="rounded-card border border-ink-900/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-900" htmlFor="exception-type">
              Status
            </label>
            <select
              id="exception-type"
              value={exceptionAvailable ? "available" : "unavailable"}
              onChange={(e) => setExceptionAvailable(e.target.value === "available")}
              className="rounded-card border border-ink-900/15 px-3 py-2 text-sm"
            >
              <option value="unavailable">Unavailable</option>
              <option value="available">Available</option>
            </select>
          </div>
          <button className="btn-primary" onClick={handleAddException} disabled={!exceptionDate}>
            Add exception
          </button>
        </div>

        {exceptions.length === 0 ? (
          <p className="text-sm text-ink-400">No exceptions set.</p>
        ) : (
          <ul className="space-y-1.5">
            {exceptions.map((ex) => (
              <li key={ex.id} className="flex items-center justify-between rounded-card border border-ink-900/10 px-3 py-2 text-sm">
                <span>
                  {format(new Date(ex.date!), "EEE, MMM d, yyyy")} ·{" "}
                  <span className={ex.available ? "text-signal-green" : "text-signal-red"}>
                    {ex.available ? "Available" : "Unavailable"}
                  </span>
                </span>
                <button onClick={() => removeException(ex.id, user.id)} className="text-ink-400 hover:text-signal-red">
                  <XIcon size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
