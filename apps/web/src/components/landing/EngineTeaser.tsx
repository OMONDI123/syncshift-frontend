import { useMemo, useState } from "react";
import { checkAssignment } from "@/lib/constraints";
import { availability, collisionShiftId, locations, shifts, users } from "@/data/seed";
import { useSettingsStore } from "@/store/settingsStore";
import { ConstraintExplainer } from "@/components/schedule/ConstraintExplainer";
import { Avatar } from "@/components/common/Avatar";
import { formatShiftRange } from "@/lib/time";

const locationsById = Object.fromEntries(locations.map((l) => [l.id, l]));

const CANDIDATE_IDS = ["u-ava", "u-sarah", "u-liam"];

export function EngineTeaser() {
  const [selectedId, setSelectedId] = useState(CANDIDATE_IDS[0]);
  const thresholds = useSettingsStore((s) => s.constraintThresholds);

  const shift = shifts.find((s) => s.id === collisionShiftId)!;
  const location = locationsById[shift.locationId];
  const candidates = CANDIDATE_IDS.map((id) => users.find((u) => u.id === id)!);
  const selected = candidates.find((c) => c.id === selectedId)!;

  const check = useMemo(() => {
    const othersShifts = shifts.filter((s) => s.id !== shift.id && s.assignedUserIds.includes(selectedId));
    return checkAssignment(selected, shift, othersShifts, locationsById, availability, users, shifts, { thresholds });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, thresholds]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gold-500">Try it without an account</p>
        <h3 className="font-heading text-2xl font-bold text-white sm:text-3xl">
          The exact same rule engine that runs the real Schedule board
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          A Saturday night bartender shift at Miami Shore just opened up. Pick who a manager might try to assign —
          this runs the identical skill, certification, availability, and hour-limit checks the live app enforces
          server-side once you sign in, and tells you exactly why, not just yes or no.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {candidates.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`flex items-center gap-2 rounded-card border px-3 py-2 text-sm font-medium transition ${
                selectedId === c.id
                  ? "border-gold-500 bg-gold-500/10 text-white"
                  : "border-white/10 text-white/70 hover:border-white/25 hover:text-white"
              }`}
            >
              <Avatar name={c.name} color={c.avatarColor} size="sm" />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-xl">
        <div className="mb-4 rounded-card bg-paper-50 p-3">
          <p className="font-heading text-sm font-semibold text-ink-900">{location.name}</p>
          <p className="text-sm text-ink-600">{formatShiftRange(shift, location)} · Bartender needed</p>
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Assigning {selected.name}…
        </p>
        <ConstraintExplainer check={check} />
      </div>
    </div>
  );
}
