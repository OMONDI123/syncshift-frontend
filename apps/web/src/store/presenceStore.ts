import { create } from "zustand";
import type { ClockRecord } from "@/types";
import { realtimeClient } from "@/lib/realtime";
import { presenceApi, ApiRequestError } from "@/lib/api";
import { mapClockRecord } from "@/lib/mappers";
import { withRetry } from "@/lib/retry";

interface PresenceState {
  records: ClockRecord[];
  loaded: boolean;

  onDutyAt: (locationId: string) => ClockRecord[];
  isClockedIn: (userId: string, shiftId: string) => boolean;

  /** Fetches who's currently on duty at each given location (the "On Duty
   * Now" board only ever needs currently-clocked-in staff, never history)
   * and subscribes to live clock-in/out events for those locations. */
  loadForLocations: (locationIds: string[]) => Promise<void>;
  clockIn: (userId: string, shiftId: string) => Promise<{ success: boolean; reason?: string }>;
  clockOut: (userId: string, shiftId: string) => Promise<{ success: boolean; reason?: string }>;
}

const subscribedTopics = new Set<string>();

export const usePresenceStore = create<PresenceState>((set, get) => ({
  records: [],
  loaded: false,

  onDutyAt: (locationId) => get().records.filter((r) => r.locationId === locationId && !r.clockOutUtc),

  isClockedIn: (userId, shiftId) => get().records.some((r) => r.userId === userId && r.shiftId === shiftId && !r.clockOutUtc),

  loadForLocations: async (locationIds) => {
    const lists = await Promise.all(
      locationIds.map((id) => withRetry(() => presenceApi.onDutyAt(Number(id)), [])),
    );
    const fresh = lists.flat().map(mapClockRecord);
    set({ records: fresh, loaded: true });

    locationIds.forEach((locId) => {
      const topic = `/topic/locations/${locId}/presence`;
      if (subscribedTopics.has(topic)) return;
      subscribedTopics.add(topic);
      realtimeClient.subscribe(topic, (payload) => {
        if (!payload || typeof payload !== "object" || !("record" in payload)) return;
        const record = mapClockRecord((payload as { record: Parameters<typeof mapClockRecord>[0] }).record);
        set((s) => {
          const exists = s.records.some((r) => r.id === record.id);
          return { records: exists ? s.records.map((r) => (r.id === record.id ? record : r)) : [...s.records, record] };
        });
      });
    });
  },

  clockIn: async (_userId, shiftId) => {
    try {
      const dto = await presenceApi.clockIn(Number(shiftId));
      const record = mapClockRecord(dto);
      set((s) => ({ records: [...s.records.filter((r) => r.id !== record.id), record] }));
      return { success: true };
    } catch (err) {
      return { success: false, reason: err instanceof ApiRequestError ? err.message : "Couldn't clock in." };
    }
  },

  clockOut: async (userId, shiftId) => {
    try {
      const dto = await presenceApi.clockOut(Number(shiftId));
      const record = mapClockRecord(dto);
      set((s) => ({ records: s.records.map((r) => (r.userId === userId && r.shiftId === shiftId ? record : r)) }));
      return { success: true };
    } catch (err) {
      return { success: false, reason: err instanceof ApiRequestError ? err.message : "Couldn't clock out." };
    }
  },
}));
