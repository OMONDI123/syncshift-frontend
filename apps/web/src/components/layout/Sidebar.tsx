import { NavLink } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import { Avatar } from "@/components/common/Avatar";
import { Badge } from "@/components/common/Badge";
import {
  CalendarIcon,
  ClockIcon,
  ScaleIcon,
  DocumentIcon,
  BuildingIcon,
  ShuffleIcon,
  LogOutIcon,
  XIcon,
  MoonIcon,
  UsersIcon,
  SettingsIcon,
} from "@/components/icons/Icon";
import type { Role } from "@/types";
import type { ReactNode } from "react";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles: Role[];
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Scheduling",
    items: [
      { to: "/schedule", label: "Schedule board", icon: <CalendarIcon size={17} />, roles: ["MANAGER", "ADMIN"] },
      { to: "/on-duty", label: "On duty now", icon: <MoonIcon size={17} />, roles: ["MANAGER", "ADMIN"] },
      { to: "/my-shifts", label: "My shifts", icon: <CalendarIcon size={17} />, roles: ["STAFF"] },
      { to: "/availability", label: "My availability", icon: <ClockIcon size={17} />, roles: ["STAFF"] },
      { to: "/marketplace", label: "Marketplace", icon: <ShuffleIcon size={17} />, roles: ["STAFF"] },
    ],
  },
  {
    title: "Insights",
    items: [
      { to: "/overtime", label: "Overtime & labor", icon: <ClockIcon size={17} />, roles: ["MANAGER", "ADMIN"] },
      { to: "/fairness", label: "Fairness report", icon: <ScaleIcon size={17} />, roles: ["MANAGER", "ADMIN"] },
    ],
  },
  {
    title: "Organisation",
    items: [
      { to: "/admin", label: "Overview", icon: <BuildingIcon size={17} />, roles: ["ADMIN"] },
      { to: "/admin/users", label: "Users & roles", icon: <UsersIcon size={17} />, roles: ["ADMIN"] },
      { to: "/admin/setup", label: "System setup", icon: <SettingsIcon size={17} />, roles: ["ADMIN"] },
      { to: "/audit-log", label: "Audit log", icon: <DocumentIcon size={17} />, roles: ["ADMIN", "MANAGER"] },
    ],
  },
];

const roleLabel: Record<Role, string> = { ADMIN: "Corporate admin", MANAGER: "Manager", STAFF: "Staff" };

export function Sidebar() {
  const user = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  if (!user) return null;

  const content = (
    <div className="flex h-full w-64 shrink-0 flex-col bg-navy-950 text-white">
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-card bg-gold-500 font-heading text-sm font-extrabold text-navy-950">
            CE
          </span>
          <div>
            <p className="font-heading text-sm font-bold leading-tight">ShiftSync</p>
            <p className="text-[11px] text-white/50">Coastal Eats</p>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
          className="rounded-card p-1.5 text-white/60 hover:bg-white/10 lg:hidden"
        >
          <XIcon size={18} />
        </button>
      </div>

      <nav className="mt-1 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {sections.map((section) => {
          const visible = section.items.filter((i) => i.roles.includes(user.role));
          if (visible.length === 0) return null;
          return (
            <div key={section.title}>
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-white/35">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {visible.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-card px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? "bg-gold-500 text-navy-950 shadow-sm"
                          : "text-white/70 hover:bg-white/8 hover:text-white"
                      }`
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex items-center gap-2 rounded-card bg-white/5 px-2.5 py-2">
          <Avatar name={user.name} color={user.avatarColor} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <Badge tone="gold">{roleLabel[user.role]}</Badge>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-card px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/8 hover:text-white"
        >
          <LogOutIcon size={17} />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden lg:block">{content}</div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10">{content}</div>
        </div>
      )}
    </>
  );
}
