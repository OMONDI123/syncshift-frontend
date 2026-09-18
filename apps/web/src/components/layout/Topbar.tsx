import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import { Avatar } from "@/components/common/Avatar";
import { Badge } from "@/components/common/Badge";
import { ConnectionStatus } from "@/components/common/ConnectionStatus";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { MenuIcon, LockIcon } from "@/components/icons/Icon";
import { sessionMinutesRemaining } from "@/lib/auth";

const roleLabel: Record<string, string> = {
  ADMIN: "Corporate admin",
  MANAGER: "Manager",
  STAFF: "Staff",
};

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const user = useAuthStore((s) => s.currentUser);
  const session = useAuthStore((s) => s.session);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const [minutesLeft, setMinutesLeft] = useState(45);

  useEffect(() => {
    if (!session) return;
    const tick = () => setMinutesLeft(Math.round(sessionMinutesRemaining(session)));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [session]);

  if (!user) return null;

  return (
    <header className="flex items-center justify-between gap-3 border-b border-ink-900/10 bg-white/90 px-4 py-3.5 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          className="rounded-card p-1.5 text-ink-600 hover:bg-paper-100 lg:hidden"
        >
          <MenuIcon size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate font-heading text-lg font-bold text-ink-900 sm:text-xl">{title}</h1>
          {subtitle && <p className="hidden truncate text-sm text-ink-600 sm:block">{subtitle}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <div className="hidden sm:block">
          <ConnectionStatus />
        </div>
        <span
          title="Your JWT expires after 45 minutes of issuance — sign in again once it does"
          className={`hidden items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold sm:inline-flex ${
            minutesLeft <= 10 ? "border-signal-amber/30 bg-signal-amberBg text-signal-amber" : "border-ink-900/10 bg-paper-50 text-ink-400"
          }`}
        >
          <LockIcon size={12} />
          {minutesLeft}m session
        </span>
        <NotificationBell />
        <div className="flex items-center gap-2 border-l border-ink-900/10 pl-3 sm:pl-4">
          <Avatar name={user.name} color={user.avatarColor} size="sm" />
          <div className="hidden text-right md:block">
            <p className="text-sm font-semibold leading-tight text-ink-900">{user.name}</p>
            <Badge tone="neutral">{roleLabel[user.role]}</Badge>
          </div>
        </div>
      </div>
    </header>
  );
}
