import { create } from "zustand";
import { notificationsApi } from "@/lib/api";
import { mapNotification } from "@/lib/mappers";
import type { AppNotification } from "@/types";
import { realtimeClient } from "@/lib/realtime";
import { withRetry } from "@/lib/retry";

interface NotificationState {
  notifications: AppNotification[];
  loaded: boolean;

  forUser: (userId: string) => AppNotification[];
  unreadCountFor: (userId: string) => number;

  /** Fetches this user's notification history and subscribes to
   * `/topic/users/{id}/notifications` for anything new (see
   * `notification/NotificationService.send` on the backend). */
  load: (userId: string) => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: (userId: string) => void;
}

let subscribedUserId: string | null = null;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  loaded: false,

  forUser: (userId) =>
    get()
      .notifications.filter((n) => n.userId === userId)
      .sort((a, b) => (a.createdAtUtc < b.createdAtUtc ? 1 : -1)),

  unreadCountFor: (userId) => get().notifications.filter((n) => n.userId === userId && !n.read).length,

  load: async (userId) => {
    const dtos = await withRetry(() => notificationsApi.list(), []);
    set({ notifications: dtos.map((dto) => mapNotification(dto, userId)), loaded: true });

    if (subscribedUserId === userId) return;
    subscribedUserId = userId;
    realtimeClient.subscribe(`/topic/users/${userId}/notifications`, (payload) => {
      if (payload && typeof payload === "object" && "id" in payload) {
        const notification = mapNotification(payload as Parameters<typeof mapNotification>[0], userId);
        set((s) => ({ notifications: [notification, ...s.notifications.filter((n) => n.id !== notification.id)] }));
      }
    });
  },

  markRead: (id) => {
    set((state) => ({ notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
    notificationsApi.markRead(Number(id)).catch(() => {
      // Best-effort — a failed read receipt isn't worth surfacing an error for.
    });
  },

  markAllRead: (userId) => {
    set((state) => ({ notifications: state.notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n)) }));
    notificationsApi.markAllRead().catch(() => {
      // Best-effort, same as markRead.
    });
  },
}));
