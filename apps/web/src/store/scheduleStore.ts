import { create } from "zustand";
import {
  ApiRequestError,
  AssignmentBlockedError,
  locationsApi,
  setupApi,
  shiftsApi,
  usersApi,
  type CreateUserRequestDto,
  type ShiftDto,
} from "@/lib/api";
import { mapLocation, mapShift, mapUser, mapAssignmentCheck } from "@/lib/mappers";
import type { AssignmentCheck, Location, Shift, User } from "@/types";
import { realtimeClient } from "@/lib/realtime";
import { useSettingsStore } from "@/store/settingsStore";

export interface MutationResult {
  success: boolean;
  check?: AssignmentCheck;
  conflict?: boolean;
  unauthorized?: boolean;
  reason?: string;
  /** Set by createShift on success so callers (the "Create shift" modal)
   * can immediately open the Assign drawer for it — a brand new shift has
   * zero assigned staff, which means no one gets notified on publish and
   * no one can clock in, so nudging straight into assignment prevents a
   * manager from creating a shift, publishing it, and wondering why staff
   * never heard about it. */
  shiftId?: string;
}

export interface NewLocationInput {
  name: string;
  city: string;
  timezone: string;
}

export interface NewUserInput {
  name: string;
  email: string;
  role: User["role"];
  skills: User["skills"];
  certifiedLocationIds: string[];
  managedLocationIds: string[];
  desiredWeeklyHours?: number;
  homeTimezone: string;
}

interface ScheduleState {
  shifts: Shift[];
  locations: Location[];
  staff: User[];
  locationsById: Record<string, Location>;
  loaded: boolean;

  shiftsForUser: (userId: string) => Shift[];

  /** Fetches locations, the full staff roster, and every shift relevant
   * to this user's role, then subscribes to live updates for those
   * locations. Called once after login (see authStore). */
  loadInitial: (user: User) => Promise<void>;
  refreshShiftsForLocation: (locationId: string) => Promise<void>;

  evaluateAssignment: (shiftId: string, userId: string) => Promise<AssignmentCheck>;
  assignUser: (
    shiftId: string,
    userId: string,
    actorUserId: string,
    opts?: { override?: boolean; overrideReason?: string; expectedVersion?: number },
  ) => Promise<MutationResult>;
  unassignUser: (shiftId: string, userId: string, actorUserId: string) => Promise<MutationResult>;
  publishLocationWeek: (locationId: string, actorUserId: string) => Promise<MutationResult>;
  /** Requirement #2: "Unpublish/edit a schedule before a configurable
   * cutoff." The backend endpoint (`POST /shifts/{id}/unpublish`) already
   * supported this, override-reason and all — nothing in the UI ever called
   * it until now. */
  unpublishShift: (
    shiftId: string,
    actorUserId: string,
    opts?: { expectedVersion?: number; overrideCutoff?: boolean; overrideReason?: string },
  ) => Promise<MutationResult>;
  createShift: (
    input: { locationId: string; skillRequired: string; headcountNeeded: number; startUtc: string; endUtc: string; notes?: string },
    actorUserId: string,
  ) => Promise<MutationResult>;
  updateShift: (shiftId: string, patch: Partial<Shift>, actorUserId: string) => Promise<MutationResult>;
  deleteShift: (shiftId: string, actorUserId: string) => Promise<MutationResult>;
  /** Kept for the router/other stores that log a client-side security
   * event — the backend is the real audit authority now (every denied
   * action is already recorded server-side by PermissionService), so this
   * is just a dev-console breadcrumb, not a write. */
  logSecurityEvent: (actorUserId: string, action: string, entityId: string) => void;

  createUser: (input: NewUserInput, actorUserId: string) => Promise<MutationResult>;
  updateUser: (userId: string, patch: Partial<NewUserInput>, actorUserId: string) => Promise<MutationResult>;
  setUserActive: (userId: string, active: boolean, actorUserId: string) => Promise<MutationResult>;

  createLocation: (input: NewLocationInput, actorUserId: string) => Promise<MutationResult>;
  updateLocation: (locationId: string, patch: Partial<NewLocationInput>, actorUserId: string) => Promise<MutationResult>;
  deleteLocation: (locationId: string, actorUserId: string) => Promise<MutationResult>;
}

function fromApiError(err: unknown, fallback: string): MutationResult {
  if (err instanceof AssignmentBlockedError) {
    return { success: false, check: mapAssignmentCheck(err.check) };
  }
  if (err instanceof ApiRequestError) {
    return {
      success: false,
      unauthorized: err.status === 403,
      conflict: err.status === 409,
      reason: err.message,
    };
  }
  return { success: false, reason: fallback };
}

const subscribedLocationTopics = new Set<string>();

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  shifts: [],
  locations: [],
  staff: [],
  locationsById: {},
  loaded: false,

  shiftsForUser: (userId) => get().shifts.filter((s) => s.assignedUserIds.includes(userId)),

  loadInitial: async (user) => {
    const [locationDtos, userDtos] = await Promise.all([locationsApi.list(), usersApi.list()]);
    const locations = locationDtos.map(mapLocation);
    const staff = userDtos.map(mapUser);
    const locationsById = Object.fromEntries(locations.map((l) => [l.id, l]));
    set({ locations, staff, locationsById });

    const relevantLocationIds =
      user.role === "ADMIN"
        ? locations.map((l) => l.id)
        : user.role === "MANAGER"
          ? user.managedLocationIds
          : user.certifiedLocationIds;

    const shiftLists = await Promise.all(
      relevantLocationIds.map((locId) => shiftsApi.listByLocation(Number(locId)).catch(() => [] as ShiftDto[])),
    );
    const byId = new Map<string, Shift>();
    shiftLists.flat().forEach((dto) => byId.set(String(dto.id), mapShift(dto)));
    set({ shifts: [...byId.values()], loaded: true });

    relevantLocationIds.forEach((locId) => {
      const topic = `/topic/locations/${locId}/schedule`;
      if (subscribedLocationTopics.has(topic)) return;
      subscribedLocationTopics.add(topic);
      realtimeClient.subscribe(topic, (payload) => {
        if (payload && typeof payload === "object") {
          if ("weekPublished" in payload) {
            get().refreshShiftsForLocation(locId);
            return;
          }
          if ("deletedShiftId" in payload) {
            const deletedId = String((payload as { deletedShiftId: number }).deletedShiftId);
            set((s) => ({ shifts: s.shifts.filter((sh) => sh.id !== deletedId) }));
            return;
          }
          if ("id" in payload && "startUtc" in payload) {
            const shift = mapShift(payload as ShiftDto);
            set((s) => {
              const exists = s.shifts.some((sh) => sh.id === shift.id);
              return { shifts: exists ? s.shifts.map((sh) => (sh.id === shift.id ? shift : sh)) : [...s.shifts, shift] };
            });
          }
        }
      });
    });
  },

  refreshShiftsForLocation: async (locationId) => {
    const dtos = await shiftsApi.listByLocation(Number(locationId));
    const fresh = dtos.map(mapShift);
    set((s) => ({
      shifts: [...s.shifts.filter((sh) => sh.locationId !== locationId), ...fresh],
    }));
  },

  evaluateAssignment: async (shiftId, userId) => {
    try {
      const dto = await shiftsApi.checkAssignment(Number(shiftId), Number(userId));
      return mapAssignmentCheck(dto);
    } catch (err) {
      if (err instanceof AssignmentBlockedError) return mapAssignmentCheck(err.check);
      return { ok: false, violations: [], suggestions: [] };
    }
  },

  logSecurityEvent: (actorUserId, action, entityId) => {
    // eslint-disable-next-line no-console
    console.debug(`[security] ${action} by ${actorUserId} on ${entityId} — see the backend audit log for the record.`);
  },

  assignUser: async (shiftId, userId, _actorUserId, opts) => {
    try {
      const dto = await shiftsApi.assign(Number(shiftId), {
        userId: Number(userId),
        expectedVersion: opts?.expectedVersion,
        override: opts?.override,
        overrideReason: opts?.overrideReason,
      });
      const shift = mapShift(dto);
      set((s) => ({ shifts: s.shifts.map((sh) => (sh.id === shift.id ? shift : sh)) }));
      return { success: true };
    } catch (err) {
      return fromApiError(err, "Couldn't assign that shift.");
    }
  },

  unassignUser: async (shiftId, userId, _actorUserId) => {
    try {
      const dto = await shiftsApi.unassign(Number(shiftId), { userId: Number(userId) });
      const shift = mapShift(dto);
      set((s) => ({ shifts: s.shifts.map((sh) => (sh.id === shift.id ? shift : sh)) }));
      return { success: true };
    } catch (err) {
      return fromApiError(err, "Couldn't remove that assignment.");
    }
  },

  publishLocationWeek: async (locationId, _actorUserId) => {
    try {
      // The frontend's board doesn't page by week — publish everything
      // currently draft for this location, starting from the earliest
      // draft shift's week.
      const draft = get().shifts.filter((s) => s.locationId === locationId && s.status === "draft");
      if (draft.length === 0) return { success: true };
      const earliest = draft.reduce((min, s) => (s.startUtc < min ? s.startUtc : min), draft[0].startUtc);
      const weekStart = new Date(earliest);
      weekStart.setUTCHours(0, 0, 0, 0);
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
      await shiftsApi.publishWeek(Number(locationId), weekStart.toISOString());
      await get().refreshShiftsForLocation(locationId);
      return { success: true };
    } catch (err) {
      return fromApiError(err, "Couldn't publish this schedule.");
    }
  },

  unpublishShift: async (shiftId, _actorUserId, opts) => {
    try {
      const dto = await shiftsApi.unpublish(Number(shiftId), opts);
      const shift = mapShift(dto);
      set((s) => ({ shifts: s.shifts.map((sh) => (sh.id === shift.id ? shift : sh)) }));
      return { success: true };
    } catch (err) {
      return fromApiError(err, "Couldn't unpublish that shift.");
    }
  },

  createShift: async (input, _actorUserId) => {
    try {
      const skillId = useSettingsStore.getState().skillNumericId(input.skillRequired);
      if (!skillId) return { success: false, reason: "Unknown skill." };
      const dto = await shiftsApi.create({
        locationId: Number(input.locationId),
        skillId,
        headcountNeeded: input.headcountNeeded,
        startUtc: input.startUtc,
        endUtc: input.endUtc,
        notes: input.notes,
      });
      const shift = mapShift(dto);
      set((s) => ({ shifts: [...s.shifts, shift] }));
      return { success: true, shiftId: shift.id };
    } catch (err) {
      return fromApiError(err, "Couldn't create that shift.");
    }
  },

  updateShift: async (shiftId, patch, _actorUserId) => {
    try {
      const skillId = patch.skillRequired ? useSettingsStore.getState().skillNumericId(patch.skillRequired) : undefined;
      const dto = await shiftsApi.update(Number(shiftId), {
        locationId: patch.locationId ? Number(patch.locationId) : undefined,
        skillId,
        headcountNeeded: patch.headcountNeeded,
        startUtc: patch.startUtc,
        endUtc: patch.endUtc,
        notes: patch.notes,
        expectedVersion: patch.version,
      });
      const shift = mapShift(dto);
      set((s) => ({ shifts: s.shifts.map((sh) => (sh.id === shift.id ? shift : sh)) }));
      return { success: true };
    } catch (err) {
      return fromApiError(err, "Couldn't save that shift.");
    }
  },

  deleteShift: async (shiftId, _actorUserId) => {
    try {
      await shiftsApi.delete(Number(shiftId));
      set((s) => ({ shifts: s.shifts.filter((sh) => sh.id !== shiftId) }));
      return { success: true };
    } catch (err) {
      return fromApiError(err, "Couldn't delete that shift.");
    }
  },

  createUser: async (input, _actorUserId) => {
    try {
      const body: CreateUserRequestDto = {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        role: input.role,
        skillKeys: input.role === "STAFF" ? input.skills : [],
        certifiedLocationIds: input.role !== "ADMIN" ? input.certifiedLocationIds.map(Number) : [],
        managedLocationIds: input.role === "MANAGER" ? input.managedLocationIds.map(Number) : [],
        desiredWeeklyHours: input.role === "STAFF" ? input.desiredWeeklyHours : undefined,
        homeTimezone: input.homeTimezone,
      };
      const dto = await usersApi.create(body);
      const user = mapUser(dto);
      set((s) => ({ staff: [...s.staff, user] }));
      return { success: true };
    } catch (err) {
      return fromApiError(err, "Couldn't create that account.");
    }
  },

  updateUser: async (userId, patch, _actorUserId) => {
    try {
      const dto = await usersApi.update(Number(userId), {
        name: patch.name,
        email: patch.email?.trim().toLowerCase(),
        role: patch.role,
        skillKeys: patch.skills,
        certifiedLocationIds: patch.certifiedLocationIds?.map(Number),
        managedLocationIds: patch.managedLocationIds?.map(Number),
        desiredWeeklyHours: patch.desiredWeeklyHours,
        homeTimezone: patch.homeTimezone,
      });
      const user = mapUser(dto);
      set((s) => ({ staff: s.staff.map((u) => (u.id === user.id ? user : u)) }));
      return { success: true };
    } catch (err) {
      return fromApiError(err, "Couldn't update that account.");
    }
  },

  setUserActive: async (userId, active, actorUserId) => {
    if (userId === actorUserId && !active) {
      return { success: false, reason: "You can't deactivate your own account." };
    }
    try {
      const dto = await usersApi.setActive(Number(userId), active);
      const user = mapUser(dto);
      set((s) => ({ staff: s.staff.map((u) => (u.id === user.id ? user : u)) }));
      return { success: true };
    } catch (err) {
      return fromApiError(err, "Couldn't update that account.");
    }
  },

  createLocation: async (input, _actorUserId) => {
    try {
      const dto = await setupApi.createLocation({ name: input.name.trim(), city: input.city.trim(), timezone: input.timezone });
      const location = mapLocation(dto);
      set((s) => ({ locations: [...s.locations, location], locationsById: { ...s.locationsById, [location.id]: location } }));
      return { success: true };
    } catch (err) {
      return fromApiError(err, "Couldn't save that location.");
    }
  },

  updateLocation: async (locationId, patch, _actorUserId) => {
    try {
      const before = get().locationsById[locationId];
      const dto = await setupApi.updateLocation(Number(locationId), {
        name: patch.name?.trim() || before?.name || "",
        city: patch.city?.trim() || before?.city,
        timezone: patch.timezone ?? before?.timezone ?? "UTC",
      });
      const location = mapLocation(dto);
      set((s) => ({
        locations: s.locations.map((l) => (l.id === location.id ? location : l)),
        locationsById: { ...s.locationsById, [location.id]: location },
      }));
      return { success: true };
    } catch (err) {
      return fromApiError(err, "Couldn't save that location.");
    }
  },

  deleteLocation: async (locationId, _actorUserId) => {
    try {
      await setupApi.deleteLocation(Number(locationId));
      set((s) => {
        const restById = Object.fromEntries(Object.entries(s.locationsById).filter(([id]) => id !== locationId));
        return { locations: s.locations.filter((l) => l.id !== locationId), locationsById: restById };
      });
      return { success: true };
    } catch (err) {
      return fromApiError(
        err,
        "Can't remove that location — it may still have shifts, certified staff, or managers attached. Reassign those first.",
      );
    }
  },
}));
