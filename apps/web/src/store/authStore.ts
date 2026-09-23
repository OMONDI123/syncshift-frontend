import { create } from "zustand";
import { ApiRequestError, authApi, clearToken, getToken, setToken, usersApi } from "@/lib/api";
import { mapUser } from "@/lib/mappers";
import { realtimeClient } from "@/lib/realtime";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useSwapStore } from "@/store/swapStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useAvailabilityStore } from "@/store/availabilityStore";
import { usePresenceStore } from "@/store/presenceStore";
import type { Session, User } from "@/types";

interface AuthState {
  currentUser: User | null;
  session: Session | null;
  hydrated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; reason?: string }>;
  logout: () => void;
  hydrate: () => Promise<void>;
  /** Requirement #7: lets the signed-in user change their OWN notification
   * channel (in-app only vs in-app + email simulation). Backed by the
   * self-service PATCH /users/me/notification-preference endpoint. */
  updateNotificationChannel: (
    channel: User["notificationChannel"],
  ) => Promise<{ success: boolean; reason?: string }>;
}

function buildSession(token: string, userId: string, expiresInMinutes: number): Session {
  return {
    token,
    userId,
    issuedAtUtc: new Date().toISOString(),
    expiresAtUtc: new Date(Date.now() + expiresInMinutes * 60_000).toISOString(),
  };
}

/** Loads every store the app needs data from, all keyed off the freshly
 * signed-in user's role. Order matters a little: schedule (locations +
 * shifts) and settings (skills + thresholds) go first since swaps,
 * presence, and the assignment-check engine all read from them.
 *
 * Presence used to be deferred for admins/managers until OnDutyPage
 * mounted, to shrink the login burst. That introduced a worse problem
 * than it solved (a mount-timing edge case left the on-duty board
 * genuinely empty for some admins/managers), so it's back to loading
 * eagerly for every role here — the actual fix for the original burst
 * issue is the retry-with-backoff wrapper (lib/retry.ts) on every one of
 * these calls, not removing the data. OnDutyPage still refreshes it again
 * on mount as a belt-and-braces "give me the freshest state" call. */
async function bootstrapAppData(user: User) {
  realtimeClient.connect();
  await Promise.all([useScheduleStore.getState().loadInitial(user), useSettingsStore.getState().load()]);

  const relevantLocationIds =
    user.role === "ADMIN"
      ? useScheduleStore.getState().locations.map((l) => l.id)
      : user.role === "MANAGER"
        ? user.managedLocationIds
        : user.certifiedLocationIds;

  await Promise.all([
    useSwapStore.getState().load(user),
    useNotificationStore.getState().load(user.id),
    useAvailabilityStore.getState().loadForUser(user.id),
    usePresenceStore.getState().loadForLocations(relevantLocationIds),
  ]);
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  session: null,
  hydrated: false,
  loading: false,

  hydrate: async () => {
    const token = getToken();
    if (!token) {
      set({ hydrated: true });
      return;
    }
    try {
      const summary = await authApi.me();
      const full = await usersApi.get(summary.id);
      const user = mapUser(full);
      set({ currentUser: user, session: buildSession(token, user.id, 45), hydrated: true });
      // A failure here is now caught separately from the auth check above:
      // bootstrapAppData's individual loaders already retry transient
      // failures internally (see lib/retry.ts), but if something still
      // genuinely fails, that should never log a just-verified, valid
      // session back out — it used to, because this whole function shared
      // one try/catch, so one flaky request in the ~15-request login burst
      // could silently bounce a real user back to the login screen even
      // though their credentials were fine.
      try {
        await bootstrapAppData(user);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("Some app data failed to load after login; staying signed in.", err);
      }
    } catch {
      clearToken();
      set({ currentUser: null, session: null, hydrated: true });
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await authApi.login(email, password);
      setToken(res.token);
      const full = await usersApi.get(res.user.id);
      const user = mapUser(full);
      set({
        currentUser: user,
        session: buildSession(res.token, user.id, res.expiresInMinutes),
        loading: false,
        hydrated: true,
      });
      // Same fix as hydrate() above: don't let a flaky secondary request
      // report the login itself as failed when the credentials were fine
      // and the session is already set.
      try {
        await bootstrapAppData(user);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("Some app data failed to load after login; continuing anyway.", err);
      }
      return { success: true };
    } catch (err) {
      set({ loading: false });
      const reason =
        err instanceof ApiRequestError
          ? err.message
          : "Couldn't reach the ShiftSync API. Check your connection and try again.";
      return { success: false, reason };
    }
  },

  logout: () => {
    clearToken();
    realtimeClient.disconnect();
    set({ currentUser: null, session: null });
  },

  updateNotificationChannel: async (channel) => {
    try {
      const dto = await usersApi.updateMyNotificationPreference(channel);
      const updated = mapUser(dto);
      set((s) => (s.currentUser ? { currentUser: { ...s.currentUser, notificationChannel: updated.notificationChannel } } : {}));
      return { success: true };
    } catch (err) {
      return {
        success: false,
        reason: err instanceof ApiRequestError ? err.message : "Couldn't update your notification preference.",
      };
    }
  },
}));
