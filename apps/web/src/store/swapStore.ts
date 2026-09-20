import { create } from "zustand";
import { ApiRequestError, swapsApi } from "@/lib/api";
import { mapSwap } from "@/lib/mappers";
import type { SwapRequest, User } from "@/types";
import { useScheduleStore } from "@/store/scheduleStore";
import { realtimeClient } from "@/lib/realtime";
import { withRetry } from "@/lib/retry";

interface SwapResult {
  success: boolean;
  reason?: string;
  unauthorized?: boolean;
}

interface SwapState {
  swaps: SwapRequest[];
  loaded: boolean;

  pendingCountFor: (userId: string) => number;
  forShift: (shiftId: string) => SwapRequest[];
  pendingApprovalsFor: (managerLocationIds: string[]) => SwapRequest[];

  /** Fetches every swap relevant to this user (their own requests, open
   * drops at their certified locations, or — for managers/admins —
   * pending approvals across their locations) and subscribes to live
   * updates for those same locations. Called once after login. */
  load: (user: User) => Promise<void>;

  requestSwap: (shiftId: string, requestedByUserId: string, partnerUserId: string) => Promise<SwapResult>;
  requestDrop: (shiftId: string, requestedByUserId: string) => Promise<SwapResult>;
  partnerAccept: (swapId: string) => Promise<SwapResult>;
  pickUpDrop: (swapId: string, pickerUserId: string) => Promise<SwapResult>;
  managerApprove: (swapId: string, managerId: string) => Promise<SwapResult>;
  managerReject: (swapId: string, managerId: string, reason: string) => Promise<SwapResult>;
  /** Staff A changes their mind before manager approval ("Regret Swap"). */
  requesterCancel: (swapId: string) => Promise<SwapResult>;
}

function upsert(swaps: SwapRequest[], swap: SwapRequest): SwapRequest[] {
  const exists = swaps.some((s) => s.id === swap.id);
  return exists ? swaps.map((s) => (s.id === swap.id ? swap : s)) : [swap, ...swaps];
}

function reasonFor(err: unknown, fallback: string): SwapResult {
  if (err instanceof ApiRequestError) {
    return { success: false, unauthorized: err.status === 403, reason: err.message };
  }
  return { success: false, reason: fallback };
}

const subscribedTopics = new Set<string>();

export const useSwapStore = create<SwapState>((set, get) => ({
  swaps: [],
  loaded: false,

  pendingCountFor: (userId) =>
    get().swaps.filter(
      (s) =>
        s.requestedByUserId === userId &&
        (s.status === "pending_partner" || s.status === "open" || s.status === "pending_manager"),
    ).length,

  forShift: (shiftId) => get().swaps.filter((s) => s.shiftId === shiftId),

  pendingApprovalsFor: (managerLocationIds) => {
    const shifts = useScheduleStore.getState().shifts;
    return get().swaps.filter((s) => {
      if (s.status !== "pending_manager") return false;
      const shift = shifts.find((sh) => sh.id === s.shiftId);
      return shift && managerLocationIds.includes(shift.locationId);
    });
  },

  load: async (user) => {
    const isManagerLike = user.role === "ADMIN" || user.role === "MANAGER";
    const [openDtos, mineDtos, approvalDtos] = await Promise.all([
      withRetry(() => swapsApi.open(), []),
      withRetry(() => swapsApi.mine(), []),
      isManagerLike ? withRetry(() => swapsApi.pendingApprovals(), []) : Promise.resolve([]),
    ]);
    const byId = new Map<string, SwapRequest>();
    [...openDtos, ...mineDtos, ...approvalDtos].forEach((dto) => byId.set(String(dto.id), mapSwap(dto)));
    set({ swaps: [...byId.values()], loaded: true });

    const relevantLocationIds =
      user.role === "ADMIN"
        ? useScheduleStore.getState().locations.map((l) => l.id)
        : user.role === "MANAGER"
          ? user.managedLocationIds
          : user.certifiedLocationIds;

    relevantLocationIds.forEach((locId) => {
      const topic = `/topic/locations/${locId}/swaps`;
      if (subscribedTopics.has(topic)) return;
      subscribedTopics.add(topic);
      realtimeClient.subscribe(topic, (payload) => {
        if (payload && typeof payload === "object" && "id" in payload) {
          const swap = mapSwap(payload as Parameters<typeof mapSwap>[0]);
          set((s) => ({ swaps: upsert(s.swaps, swap) }));
        }
      });
    });
  },

  requestSwap: async (shiftId, _requestedByUserId, partnerUserId) => {
    try {
      const dto = await swapsApi.requestSwap(Number(shiftId), Number(partnerUserId));
      set((s) => ({ swaps: upsert(s.swaps, mapSwap(dto)) }));
      return { success: true };
    } catch (err) {
      return reasonFor(err, "Couldn't submit that swap request.");
    }
  },

  requestDrop: async (shiftId, _requestedByUserId) => {
    try {
      const dto = await swapsApi.requestDrop(Number(shiftId));
      set((s) => ({ swaps: upsert(s.swaps, mapSwap(dto)) }));
      return { success: true };
    } catch (err) {
      return reasonFor(err, "Couldn't drop that shift.");
    }
  },

  partnerAccept: async (swapId) => {
    try {
      const dto = await swapsApi.partnerAccept(Number(swapId));
      set((s) => ({ swaps: upsert(s.swaps, mapSwap(dto)) }));
      return { success: true };
    } catch (err) {
      return reasonFor(err, "Couldn't accept that swap.");
    }
  },

  pickUpDrop: async (swapId, _pickerUserId) => {
    try {
      const dto = await swapsApi.pickUp(Number(swapId));
      set((s) => ({ swaps: upsert(s.swaps, mapSwap(dto)) }));
      return { success: true };
    } catch (err) {
      return reasonFor(err, "Couldn't pick up that shift.");
    }
  },

  managerApprove: async (swapId, _managerId) => {
    try {
      const dto = await swapsApi.managerApprove(Number(swapId));
      const swap = mapSwap(dto);
      set((s) => ({ swaps: upsert(s.swaps, swap) }));
      // The backend already applied the assignment change server-side —
      // refresh this shift's location so the schedule board reflects it
      // immediately rather than waiting on the next realtime tick.
      const shift = useScheduleStore.getState().shifts.find((sh) => sh.id === swap.shiftId);
      if (shift) await useScheduleStore.getState().refreshShiftsForLocation(shift.locationId);
      return { success: true };
    } catch (err) {
      return reasonFor(err, "Couldn't approve that request.");
    }
  },

  managerReject: async (swapId, _managerId, reason) => {
    try {
      const dto = await swapsApi.managerReject(Number(swapId), reason);
      set((s) => ({ swaps: upsert(s.swaps, mapSwap(dto)) }));
      return { success: true };
    } catch (err) {
      return reasonFor(err, "Couldn't reject that request.");
    }
  },

  requesterCancel: async (swapId) => {
    try {
      const dto = await swapsApi.cancel(Number(swapId));
      set((s) => ({ swaps: upsert(s.swaps, mapSwap(dto)) }));
      return { success: true };
    } catch (err) {
      return reasonFor(err, "Couldn't cancel that request.");
    }
  },
}));
