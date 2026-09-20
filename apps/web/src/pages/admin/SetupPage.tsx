import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";
import { useScheduleStore } from "@/store/scheduleStore";
import type { NewLocationInput } from "@/store/scheduleStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { ConstraintThresholds } from "@/lib/constraints";
import { IANA_TIMEZONES } from "@/lib/timezones";
import { Modal } from "@/components/common/Modal";
import { EmptyState } from "@/components/common/EmptyState";
import { useUiStore } from "@/store/uiStore";
import {
  BuildingIcon,
  ClockIcon,
  PlusIcon,
  ScaleIcon,
  SettingsIcon,
  TrashIcon,
} from "@/components/icons/Icon";
import type { Location } from "@/types";
import type { ReactNode } from "react";

type Tab = "locations" | "skills" | "rules";

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "locations", label: "Locations", icon: <BuildingIcon size={16} /> },
  { id: "skills", label: "Skills", icon: <ScaleIcon size={16} /> },
  { id: "rules", label: "Scheduling rules", icon: <ClockIcon size={16} /> },
];

const emptyLocationForm: NewLocationInput = { name: "", city: "", timezone: IANA_TIMEZONES[0] };
const emptySkillForm = { label: "", color: "#2FAE66" };

export function SetupPage() {
  const [tab, setTab] = useState<Tab>("locations");

  return (
    <AppShell
      title="System setup"
      subtitle="Locations, skills, and the scheduling rules the assignment engine enforces everywhere else in the app"
    >
      <div className="mb-6 flex flex-wrap gap-2 border-b border-ink-900/10 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-card px-3 py-2 text-sm font-semibold transition ${
              tab === t.id ? "bg-navy-950 text-white" : "text-ink-600 hover:bg-paper-100"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "locations" && <LocationsPanel />}
      {tab === "skills" && <SkillsPanel />}
      {tab === "rules" && <RulesPanel />}
    </AppShell>
  );
}

// --- Locations ------------------------------------------------------------

function LocationsPanel() {
  const currentUser = useAuthStore((s) => s.currentUser)!;
  const locations = useScheduleStore((s) => s.locations);
  const createLocation = useScheduleStore((s) => s.createLocation);
  const updateLocation = useScheduleStore((s) => s.updateLocation);
  const deleteLocation = useScheduleStore((s) => s.deleteLocation);
  const showToast = useUiStore((s) => s.showToast);

  const [editing, setEditing] = useState<Location | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NewLocationInput>(emptyLocationForm);
  const [formError, setFormError] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyLocationForm);
    setFormError(null);
    setCreating(true);
  }
  function openEdit(loc: Location) {
    setForm({ name: loc.name, city: loc.city, timezone: loc.timezone });
    setFormError(null);
    setEditing(loc);
  }
  function closeModal() {
    setCreating(false);
    setEditing(null);
  }

  async function handleSubmit() {
    const result = editing
      ? await updateLocation(editing.id, form, currentUser.id)
      : await createLocation(form, currentUser.id);
    if (result.success) {
      showToast("success", editing ? `${form.name} was updated.` : `${form.name} was added.`);
      closeModal();
    } else {
      setFormError(result.reason ?? "Couldn't save that location.");
    }
  }

  async function handleDelete(loc: Location) {
    const result = await deleteLocation(loc.id, currentUser.id);
    if (result.success) {
      showToast("info", `${loc.name} was removed.`);
    } else {
      showToast("error", result.reason ?? "Couldn't remove that location.");
    }
  }

  const modalOpen = creating || !!editing;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-600">
          {locations.length} location{locations.length === 1 ? "" : "s"} — every shift, certification, and manager
          assignment points at one of these.
        </p>
        <button className="btn-primary flex items-center gap-1.5" onClick={openCreate}>
          <PlusIcon size={14} />
          Add location
        </button>
      </div>

      {locations.length === 0 ? (
        <EmptyState title="No locations yet" body="Add a location before creating schedules or certifying staff." />
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper-100 text-xs font-semibold uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Timezone</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id} className="border-t border-ink-900/5">
                  <td className="px-4 py-3 font-medium text-ink-900">{loc.name}</td>
                  <td className="px-4 py-3 text-ink-600">{loc.city}</td>
                  <td className="px-4 py-3 text-ink-600">{loc.timezone}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(loc)} className="mr-3 text-xs font-semibold text-navy-800 hover:underline">
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(loc)}
                      className="text-xs font-semibold text-signal-red hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <Modal
          title={editing ? `Edit ${editing.name}` : "Add a location"}
          onClose={closeModal}
          footer={
            <>
              <button className="btn-secondary" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSubmit} disabled={!form.name.trim() || !form.city.trim()}>
                {editing ? "Save changes" : "Add location"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {formError && <p className="rounded-card bg-signal-redBg px-3 py-2 text-sm text-signal-red">{formError}</p>}
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-900">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Denver Depot"
                className="w-full rounded-card border border-ink-900/15 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-900">City</label>
                <input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="e.g. Denver, CO"
                  className="w-full rounded-card border border-ink-900/15 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-900">Timezone</label>
                <select
                  value={form.timezone}
                  onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                  className="w-full rounded-card border border-ink-900/15 px-3 py-2 text-sm"
                >
                  {IANA_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="rounded-card bg-paper-50 px-3 py-2 text-xs text-ink-500">
              Every shift here is checked against this timezone — staff availability is still evaluated in each
              person's own home timezone, never the location's.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

// --- Skills -----------------------------------------------------------------

function SkillsPanel() {
  const skills = useSettingsStore((s) => s.skills);
  const addSkill = useSettingsStore((s) => s.addSkill);
  const updateSkill = useSettingsStore((s) => s.updateSkill);
  const removeSkill = useSettingsStore((s) => s.removeSkill);
  const showToast = useUiStore((s) => s.showToast);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptySkillForm);
  const [formError, setFormError] = useState<string | null>(null);

  function openCreate() {
    setForm(emptySkillForm);
    setFormError(null);
    setCreating(true);
  }
  function openEdit(id: string) {
    const skill = skills.find((s) => s.id === id);
    if (!skill) return;
    setForm({ label: skill.label, color: skill.color });
    setFormError(null);
    setEditingId(id);
  }
  function closeModal() {
    setCreating(false);
    setEditingId(null);
  }

  async function handleSubmit() {
    const result = editingId
      ? await updateSkill(editingId, form)
      : await addSkill(form);
    if (result.success) {
      showToast("success", editingId ? `${form.label} was updated.` : `${form.label} was added to the catalog.`);
      closeModal();
    } else {
      setFormError(result.reason ?? "Couldn't save that skill.");
    }
  }

  async function handleRemove(id: string, label: string) {
    const result = await removeSkill(id);
    if (result.success) {
      showToast("info", `${label} was removed.`);
    } else {
      showToast("error", result.reason ?? "Couldn't remove that skill.");
    }
  }

  const modalOpen = creating || !!editingId;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-600">
          {skills.length} skill{skills.length === 1 ? "" : "s"} — used for shift requirements and staff
          certifications everywhere in the app.
        </p>
        <button className="btn-primary flex items-center gap-1.5" onClick={openCreate}>
          <PlusIcon size={14} />
          Add skill
        </button>
      </div>

      {skills.length === 0 ? (
        <EmptyState title="No skills yet" body="Add at least one skill before creating shifts or certifying staff." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <div key={skill.id} className="panel flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: skill.color }} />
                <div>
                  <p className="font-medium text-ink-900">{skill.label}</p>
                  <p className="text-xs text-ink-400">{skill.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => openEdit(skill.id)} className="text-xs font-semibold text-navy-800 hover:underline">
                  Edit
                </button>
                <button
                  onClick={() => handleRemove(skill.id, skill.label)}
                  aria-label={`Remove ${skill.label}`}
                  className="text-signal-red hover:text-signal-red/80"
                >
                  <TrashIcon size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal
          title={editingId ? "Edit skill" : "Add a skill"}
          onClose={closeModal}
          footer={
            <>
              <button className="btn-secondary" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSubmit} disabled={!form.label.trim()}>
                {editingId ? "Save changes" : "Add skill"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {formError && <p className="rounded-card bg-signal-redBg px-3 py-2 text-sm text-signal-red">{formError}</p>}
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-900">Name</label>
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Dishwasher"
                className="w-full rounded-card border border-ink-900/15 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-900">Accent color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9 w-14 cursor-pointer rounded-card border border-ink-900/15 p-1"
                />
                <input
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="w-32 rounded-card border border-ink-900/15 px-3 py-2 text-sm"
                />
              </div>
            </div>
            {!editingId && (
              <p className="rounded-card bg-paper-50 px-3 py-2 text-xs text-ink-500">
                The skill's id is derived from its name and can't be changed later — shifts and staff
                certifications reference it directly.
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// --- Scheduling rules ---------------------------------------------------

const RULE_FIELDS: { key: keyof ConstraintThresholds; label: string; hint: string }[] = [
  { key: "minRestHours", label: "Minimum rest between shifts (hours)", hint: "Blocks an assignment that leaves less time off than this between two shifts." },
  { key: "dailyHardBlockHours", label: "Daily hard limit (hours)", hint: "Hard-blocks an assignment that would push someone over this many hours in one local day." },
  { key: "dailyWarningHours", label: "Daily warning threshold (hours)", hint: "Shows a warning (not a block) once someone crosses this many hours in a day." },
  { key: "weeklyWarningHours", label: "Weekly warning threshold (hours)", hint: "Flags approaching overtime once someone crosses this many hours in a week." },
  { key: "weeklyFullTimeHours", label: "Weekly full-time / overtime threshold (hours)", hint: "Flags overtime once someone crosses this many hours in a week." },
  { key: "sixthConsecutiveDayWarning", label: "Consecutive-day warning (days)", hint: "Shows a warning once someone would work this many days in a row." },
  { key: "seventhConsecutiveDayBlock", label: "Consecutive-day hard block (days)", hint: "Blocks the assignment past this many consecutive days unless a manager documents an override." },
  { key: "maxPendingSwapsPerStaff", label: "Max pending swaps/drops per staff", hint: "A staff member can't have more open swap or drop requests than this at once." },
  { key: "dropExpiryHoursBeforeShift", label: "Drop expiry window (hours before shift)", hint: "An unclaimed dropped shift automatically expires this many hours before it starts." },
  { key: "publishEditCutoffHours", label: "Publish edit/unpublish cutoff (hours)", hint: "Editing or unpublishing a shift this close to its start requires a manager override with a reason." },
];

function RulesPanel() {
  const thresholds = useSettingsStore((s) => s.constraintThresholds);
  const updateConstraintThresholds = useSettingsStore((s) => s.updateConstraintThresholds);
  const showToast = useUiStore((s) => s.showToast);

  const [form, setForm] = useState<ConstraintThresholds>(thresholds);
  const [formError, setFormError] = useState<string | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(thresholds);

  async function handleSave() {
    const result = await updateConstraintThresholds(form);
    if (result.success) {
      setFormError(null);
      showToast("success", "Scheduling rules were updated.");
    } else {
      setFormError(result.reason ?? "Couldn't save those rules.");
    }
  }

  return (
    <div className="panel max-w-2xl p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-navy-950 text-white">
          <SettingsIcon size={16} />
        </span>
        <div>
          <p className="font-heading text-base font-semibold text-ink-900">Assignment engine rules</p>
          <p className="text-sm text-ink-600">
            These are the same thresholds <code className="text-xs">checkAssignment</code> enforces on the Schedule
            board, the Overtime dashboard, and the landing page demo — change them here rather than in code.
          </p>
        </div>
      </div>

      {formError && <p className="mb-4 rounded-card bg-signal-redBg px-3 py-2 text-sm text-signal-red">{formError}</p>}

      <div className="space-y-4">
        {RULE_FIELDS.map((field) => (
          <div key={field.key} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_120px]">
            <div>
              <label className="block text-sm font-medium text-ink-900">{field.label}</label>
              <p className="text-xs text-ink-400">{field.hint}</p>
            </div>
            <input
              type="number"
              min={0}
              value={form[field.key]}
              onChange={(e) => setForm((f) => ({ ...f, [field.key]: Number(e.target.value) }))}
              className="w-full rounded-card border border-ink-900/15 px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-ink-900/10 pt-4">
        <button className="btn-secondary" onClick={() => setForm(thresholds)} disabled={!dirty}>
          Reset
        </button>
        <button className="btn-primary" onClick={handleSave} disabled={!dirty}>
          Save rules
        </button>
      </div>
    </div>
  );
}
