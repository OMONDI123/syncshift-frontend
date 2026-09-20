import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { EmptyState } from "@/components/common/EmptyState";
import { formatDistanceToNow } from "date-fns";
import type { NotificationKind } from "@/types";

const kindIcon: Record<NotificationKind, string> = {
  shift_assigned: "📋",
  shift_changed: "✏️",
  schedule_published: "📅",
  swap_update: "🔁",
  approval_needed: "✅",
  overtime_warning: "⏱️",
  availability_changed: "🗓️",
  conflict: "⚠️",
};

export function NotificationCenter({ onClose }: { onClose?: () => void }) {
  const user = useAuthStore((s) => s.currentUser);
  const updateNotificationChannel = useAuthStore((s) => s.updateNotificationChannel);
  const items = useNotificationStore((s) => (user ? s.forUser(user.id) : []));
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const [savingPreference, setSavingPreference] = useState(false);

  if (!user) return null;

  const emailAlsoOn = user.notificationChannel === "IN_APP_AND_EMAIL";

  async function toggleEmailPreference() {
    setSavingPreference(true);
    await updateNotificationChannel(emailAlsoOn ? "IN_APP_ONLY" : "IN_APP_AND_EMAIL");
    setSavingPreference(false);
  }

  return (
    <div className="panel max-h-[70vh] overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-900/10 px-4 py-3">
        <h3 className="font-heading text-sm font-semibold text-ink-900">Notifications</h3>
        <button
          onClick={() => markAllRead(user.id)}
          className="text-xs font-semibold text-navy-800 hover:underline"
        >
          Mark all read
        </button>
      </div>
      <label className="flex items-center justify-between gap-3 border-b border-ink-900/10 px-4 py-2.5 text-xs text-ink-600">
        <span>Also email me (simulated)</span>
        <input
          type="checkbox"
          checked={emailAlsoOn}
          disabled={savingPreference}
          onChange={toggleEmailPreference}
          aria-label="Also send notifications by simulated email"
        />
      </label>
      <div className="max-h-[55vh] overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4">
            <EmptyState title="You're all caught up" body="New shift changes and swap updates will show up here." />
          </div>
        ) : (
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => {
                    markRead(n.id);
                    onClose?.();
                  }}
                  className={`flex w-full gap-3 border-b border-ink-900/5 px-4 py-3 text-left hover:bg-paper-50 ${!n.read ? "bg-gold-100/40" : ""}`}
                >
                  <span className="text-lg leading-none">{kindIcon[n.kind]}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-ink-900">{n.title}</span>
                    <span className="block text-sm text-ink-600">{n.body}</span>
                    <span className="mt-1 block text-xs text-ink-400">
                      {formatDistanceToNow(new Date(n.createdAtUtc), { addSuffix: true })}
                    </span>
                  </span>
                  {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold-500" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
