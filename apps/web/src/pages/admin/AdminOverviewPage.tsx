import { AppShell } from "@/components/layout/AppShell";
import { useScheduleStore } from "@/store/scheduleStore";
import { Avatar } from "@/components/common/Avatar";
import { Badge } from "@/components/common/Badge";
import { StatCard } from "@/components/common/StatCard";
import { BuildingIcon, UsersIcon, CalendarIcon, ChevronRightIcon, SettingsIcon } from "@/components/icons/Icon";
import { Link } from "react-router-dom";

export function AdminOverviewPage() {
  const locations = useScheduleStore((s) => s.locations);
  const staff = useScheduleStore((s) => s.staff);
  const shifts = useScheduleStore((s) => s.shifts);

  return (
    <AppShell title="Organisation" subtitle="Coastal Eats — every location, every role, in one view">
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Locations" value={locations.length} icon={<BuildingIcon size={20} />} tone="navy" />
        <StatCard
          label="Staff"
          value={staff.filter((u) => u.role === "STAFF").length}
          icon={<UsersIcon size={20} />}
          tone="gold"
        />
        <StatCard label="Shifts this week" value={shifts.length} icon={<CalendarIcon size={20} />} tone="green" />
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link to="/admin/users" className="btn-primary">
          Manage users &amp; roles
        </Link>
        <Link to="/admin/setup" className="btn-secondary flex items-center gap-1.5">
          <SettingsIcon size={14} /> System setup
        </Link>
        <Link to="/schedule" className="btn-secondary flex items-center gap-1.5">
          Open any location's schedule <ChevronRightIcon size={14} />
        </Link>
        <Link to="/audit-log" className="btn-secondary flex items-center gap-1.5">
          View audit log <ChevronRightIcon size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {locations.map((loc) => {
          const managers = staff.filter((u) => u.managedLocationIds.includes(loc.id));
          const locationShifts = shifts.filter((s) => s.locationId === loc.id);
          const understaffed = locationShifts.filter((s) => s.assignedUserIds.length < s.headcountNeeded).length;
          return (
            <div key={loc.id} className="panel p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-heading text-base font-semibold text-ink-900">{loc.name}</p>
                  <p className="text-sm text-ink-600">
                    {loc.city} · {loc.timezone}
                  </p>
                </div>
                {understaffed > 0 ? (
                  <Badge tone="amber">{understaffed} understaffed</Badge>
                ) : (
                  <Badge tone="green">Fully staffed</Badge>
                )}
              </div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Managers</p>
              <div className="flex flex-wrap gap-2">
                {managers.map((m) => (
                  <span key={m.id} className="flex items-center gap-2 rounded-full bg-paper-100 py-1 pl-1 pr-3">
                    <Avatar name={m.name} color={m.avatarColor} size="sm" />
                    <span className="text-sm text-ink-900">{m.name}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
