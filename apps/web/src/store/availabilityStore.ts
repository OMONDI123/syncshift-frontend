import { create } from "zustand";
import { availabilityApi, ApiRequestError } from "@/lib/api";
import { mapAvailability } from "@/lib/mappers";
import type { AvailabilityWindow } from "@/types";

interface AvailabilityResult {
  success: boolean;
  reason?: string;
}

interface AvailabilityState {
  windows: AvailabilityWindow[];
  loaded: boolean;

  forUser: (userId: string) => AvailabilityWindow[];
  loadForUser: (userId: string) => Promise<void>;

  setRecurring: (
    userId: string,
    dayOfWeek: number,
    startMinutes: number,
    endMinutes: number,
    actorUserId: string,
  ) => Promise<AvailabilityResult>;
  clearRecurring: (userId: string, dayOfWeek: number, actorUserId: string) => Promise<AvailabilityResult>;
  addException: (userId: string, date: string, available: boolean, actorUserId: string) => Promise<AvailabilityResult>;
  removeException: (id: string, actorUserId: string) => Promise<AvailabilityResult>;
}

function reasonFor(err: unknown, fallback: string): AvailabilityResult {
  if (err instanceof ApiRequestError) return { success: false, reason: err.message };
  return { success: false, reason: fallback };
}

export const useAvailabilityStore = create<AvailabilityState>((set, get) => ({
  windows: [],
  loaded: false,

  forUser: (userId) => get().windows.filter((w) => w.userId === userId),

  loadForUser: async (userId) => {
    const dtos = await availabilityApi.forUser(Number(userId));
    const fresh = dtos.map(mapAvailability);
    set((s) => ({ windows: [...s.windows.filter((w) => w.userId !== userId), ...fresh], loaded: true }));
  },

  setRecurring: async (userId, dayOfWeek, startMinutes, endMinutes, _actorUserId) => {
    try {
      const dto = await availabilityApi.setRecurring(Number(userId), dayOfWeek, startMinutes, endMinutes);
      const window = mapAvailability(dto);
      set((s) => ({
        windows: [...s.windows.filter((w) => !(w.userId === userId && w.type === "recurring" && w.dayOfWeek === dayOfWeek)), window],
      }));
      return { success: true };
    } catch (err) {
      return reasonFor(err, "Couldn't save your availability.");
    }
  },

  clearRecurring: async (userId, dayOfWeek, _actorUserId) => {
    try {
      await availabilityApi.clearRecurring(Number(userId), dayOfWeek);
      set((s) => ({
        windows: s.windows.filter((w) => !(w.userId === userId && w.type === "recurring" && w.dayOfWeek === dayOfWeek)),
      }));
      return { success: true };
    } catch (err) {
      return reasonFor(err, "Couldn't clear that day.");
    }
  },

  addException: async (userId, date, available, _actorUserId) => {
    try {
      const dto = await availabilityApi.addException(Number(userId), date, available);
      const window = mapAvailability(dto);
      set((s) => ({ windows: [...s.windows.filter((w) => !(w.userId === userId && w.type === "exception" && w.date === date)), window] }));
      return { success: true };
    } catch (err) {
      return reasonFor(err, "Couldn't add that exception.");
    }
  },

  removeException: async (id, actorUserId) => {
    const existing = useAvailabilityStore.getState().windows.find((w) => w.id === id);
    if (!existing) return { success: false, reason: "That exception no longer exists." };
    try {
      await availabilityApi.removeException(Number(existing.userId ?? actorUserId), Number(id));
      set((s) => ({ windows: s.windows.filter((w) => w.id !== id) }));
      return { success: true };
    } catch (err) {
      return reasonFor(err, "Couldn't remove that exception.");
    }
  },
}));
