import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { BellIconGlyph } from "@/components/icons/Icon";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.currentUser);
  const unread = useNotificationStore((s) => (user ? s.unreadCountFor(user.id) : 0));

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        className="relative rounded-full p-2 text-ink-600 hover:bg-paper-100"
      >
        <BellIconGlyph size={20} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal-red px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-96 max-w-[90vw]">
          <NotificationCenter onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
