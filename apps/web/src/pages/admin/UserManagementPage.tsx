import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";
import { Avatar } from "@/components/common/Avatar";
import { Badge } from "@/components/common/Badge";
import { Modal } from "@/components/common/Modal";
import { demoPasswordFor } from "@/lib/auth";
import { IANA_TIMEZONES } from "@/lib/timezones";
import type { NewUserInput } from "@/store/scheduleStore";
import type { Role, User } from "@/types";
import { UsersIcon } from "@/components/icons/Icon";

const emptyForm: NewUserInput = {
  name: "",
  email: "",
  role: "STAFF",
  skills: [],
  certifiedLocationIds: [],
  managedLocationIds: [],
  desiredWeeklyHours: 30,
  homeTimezone: "America/Los_Angeles",
};

const roleTone: Record<Role, "navy" | "gold" | "green"> = { ADMIN: "navy", MANAGER: "gold", STAFF: "green" };

export function UserManagementPage() {
  const currentUser = useAuthStore((s) => s.currentUser)!;
  const staff = useScheduleStore((s) => s.staff);
  const locations = useScheduleStore((s) => s.locations);
  const createUser = useScheduleStore((s) => s.createUser);
  const updateUser = useScheduleStore((s) => s.updateUser);
  const setUserActive = useScheduleStore((s) => s.setUserActive);
  const skills = useSettingsStore((s) => s.skills);
  const showToast = useUiStore((s) => s.showToast);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NewUserInput>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyForm);
    setFormError(null);
    setCreating(true);
  }

  function openEdit(user: User) {
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      skills: user.skills,
      certifiedLocationIds: user.certifiedLocationIds,
      managedLocationIds: user.managedLocationIds,
      desiredWeeklyHours: user.desiredWeeklyHours,
      homeTimezone: user.homeTimezone,
    });
    setFormError(null);
    setEditingUser(user);
  }

  function closeModal() {
    setCreating(false);
    setEditingUser(null);
  }

  function toggleInList<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function handleSubmit() {
    if (editingUser) {
      const result = await updateUser(editingUser.id, form, currentUser.id);
      if (result.success) {
        showToast("success", `${form.name}'s account was updated.`);
        closeModal();
      } else {
        setFormError(result.reason ?? "Couldn't update that account.");
      }
    } else {
      const result = await createUser(form, currentUser.id);
      if (result.success) {
        showToast(
          "success",
          `${form.name} can sign in now with the standard ${form.role.toLowerCase()} password (${demoPasswordFor(form.role)}).`,
        );
        closeModal();
      } else {
        setFormError(result.reason ?? "Couldn't create that account.");
      }
    }
  }

  async function handleToggleActive(user: User) {
    const result = await setUserActive(user.id, !user.active, currentUser.id);
    if (result.success) {
      showToast(user.active ? "info" : "success", user.active ? `${user.name} was deactivated.` : `${user.name} was reactivated.`);
    } else {
      showToast("error", result.reason ?? "Couldn't update that account.");
    }
  }

  const modalOpen = creating || !!editingUser;

  return (
    <AppShell title="Users & roles" subtitle="Create accounts, assign roles, and manage access across every location">
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-ink-600">
          <UsersIcon size={16} className="text-ink-400" />
          {staff.length} accounts · {staff.filter((u) => u.active).length} active
        </p>
        <button className="btn-primary" onClick={openCreate}>
          Add user
        </button>
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper-100 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Locations</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((u) => (
              <tr key={u.id} className={`border-t border-ink-900/5 ${!u.active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={u.name} color={u.avatarColor} size="sm" />
                    <div>
                      <p className="font-medium text-ink-900">{u.name}</p>
                      <p className="text-xs text-ink-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={roleTone[u.role]}>{u.role}</Badge>
                </td>
                <td className="px-4 py-3 text-ink-600">
                  {u.role === "MANAGER"
                    ? `Manages ${u.managedLocationIds.length}`
                    : u.role === "STAFF"
                      ? `Certified ${u.certifiedLocationIds.length}`
                      : "All locations"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={u.active ? "green" : "red"}>{u.active ? "Active" : "Deactivated"}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(u)} className="mr-3 text-xs font-semibold text-navy-800 hover:underline">
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(u)}
                    disabled={u.id === currentUser.id}
                    className="text-xs font-semibold text-signal-red hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {u.active ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal
          title={editingUser ? `Edit ${editingUser.name}` : "Add a new user"}
          onClose={closeModal}
          footer={
            <>
              <button className="btn-secondary" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSubmit} disabled={!form.name.trim() || !form.email.trim()}>
                {editingUser ? "Save changes" : "Create user"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {formError && <p className="rounded-card bg-signal-redBg px-3 py-2 text-sm text-signal-red">{formError}</p>}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-900">Full name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-card border border-ink-900/15 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-900">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-card border border-ink-900/15 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-900">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                  className="w-full rounded-card border border-ink-900/15 px-3 py-2 text-sm"
                >
                  <option value="STAFF">Staff</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-900">Home timezone</label>
                <select
                  value={form.homeTimezone}
                  onChange={(e) => setForm((f) => ({ ...f, homeTimezone: e.target.value }))}
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

            {form.role === "MANAGER" && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-900">Manages these locations</label>
                <div className="flex flex-wrap gap-2">
                  {locations.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, managedLocationIds: toggleInList(f.managedLocationIds, l.id) }))}
                      className={`rounded-card border px-3 py-1.5 text-xs font-semibold ${
                        form.managedLocationIds.includes(l.id) ? "border-gold-500 bg-gold-100 text-gold-600" : "border-ink-900/15 text-ink-600"
                      }`}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.role === "STAFF" && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-900">Skills</label>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, skills: toggleInList(f.skills, skill.id) }))}
                        className={`rounded-card border px-3 py-1.5 text-xs font-semibold ${
                          form.skills.includes(skill.id) ? "border-gold-500 bg-gold-100 text-gold-600" : "border-ink-900/15 text-ink-600"
                        }`}
                      >
                        {skill.label}
                      </button>
                    ))}
                    {skills.length === 0 && (
                      <p className="text-xs italic text-ink-400">
                        No skills defined yet — add some from Setup before assigning staff.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-900">Certified locations</label>
                  <div className="flex flex-wrap gap-2">
                    {locations.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({ ...f, certifiedLocationIds: toggleInList(f.certifiedLocationIds, l.id) }))
                        }
                        className={`rounded-card border px-3 py-1.5 text-xs font-semibold ${
                          form.certifiedLocationIds.includes(l.id) ? "border-gold-500 bg-gold-100 text-gold-600" : "border-ink-900/15 text-ink-600"
                        }`}
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-900">Desired weekly hours</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={form.desiredWeeklyHours ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, desiredWeeklyHours: Number(e.target.value) }))}
                    className="w-32 rounded-card border border-ink-900/15 px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            {!editingUser && (
              <p className="rounded-card bg-paper-50 px-3 py-2 text-xs text-ink-500">
                New accounts sign in with the standard password for their role — no separate password to set. See the
                credentials panel on the login page.
              </p>
            )}
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
