/**
 * Thin, typed wrapper around the ShiftSync REST API (see the backend's
 * README for the full endpoint list). Every store now calls through here
 * instead of mutating in-memory seed data — this file is the only place
 * that knows about HTTP, JWTs, and the backend's wire format (numeric ids,
 * UPPERCASE enums). `lib/mappers.ts` converts those wire DTOs into the
 * frontend's existing `types/index.ts` shapes so the rest of the app
 * (components, pages) barely had to change.
 */

const API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8080/api";

const TOKEN_STORAGE_KEY = "shiftsync.token.v1";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/** Shape of a 422 from ConstraintViolationException — the assignment-check
 * engine's own response, not a generic error. */
export interface AssignmentCheckDto {
  ok: boolean;
  violations: { code: string; severity: string; message: string }[];
  suggestions: { userId: number; userName: string; reason: string }[];
}

/** Generic ApiError body every other 4xx/5xx returns (GlobalExceptionHandler). */
export interface ApiErrorDto {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
}

export class ApiRequestError extends Error {
  status: number;
  body?: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.body = body;
  }
}

/** Thrown specifically for a 422 assignment-check failure so callers can
 * branch on `.check` instead of parsing a generic error. */
export class AssignmentBlockedError extends Error {
  check: AssignmentCheckDto;
  constructor(check: AssignmentCheckDto) {
    super(check.violations[0]?.message ?? "That assignment isn't allowed.");
    this.name = "AssignmentBlockedError";
    this.check = check;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function toQueryString(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

async function request<T>(
  path: string,
  init: RequestInit & { query?: Query } = {},
): Promise<T> {
  const { query, ...rest } = init;
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(rest.body ? { "Content-Type": "application/json" } : {}),
    ...(rest.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${toQueryString(query)}`, { ...rest, headers });
  } catch {
    throw new ApiRequestError(
      "Couldn't reach the ShiftSync API. Is the backend running at " + API_BASE + "?",
      0,
    );
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const raw = await res.text();
  const data = raw ? (isJson ? JSON.parse(raw) : raw) : undefined;

  if (!res.ok) {
    if (res.status === 422 && data && typeof data === "object" && "violations" in data) {
      throw new AssignmentBlockedError(data as AssignmentCheckDto);
    }
    const message =
      (data && typeof data === "object" && "message" in data && (data as ApiErrorDto).message) ||
      (typeof data === "string" ? data : undefined) ||
      res.statusText ||
      "Something went wrong.";
    throw new ApiRequestError(message, res.status, data);
  }

  return data as T;
}

const get = <T>(path: string, query?: Query) => request<T>(path, { method: "GET", query });
const post = <T>(path: string, body?: unknown, query?: Query) =>
  request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined, query });
const put = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined });
const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined });
const del = <T>(path: string, query?: Query) => request<T>(path, { method: "DELETE", query });

// --- Auth ------------------------------------------------------------------

export interface LoginResponseDto {
  token: string;
  expiresInMinutes: number;
  user: { id: number; name: string; email: string; role: string; avatarColor: string };
}

export const authApi = {
  login: (email: string, password: string) => post<LoginResponseDto>("/auth/login", { email, password }),
  me: () => get<LoginResponseDto["user"]>("/auth/me"),
};

// --- Users -------------------------------------------------------------

export interface UserDto {
  id: number;
  name: string;
  email: string;
  role: string;
  avatarColor: string;
  skills: string[];
  certifiedLocationIds: number[];
  managedLocationIds: number[];
  desiredWeeklyHours: number | null;
  hourlyRate: string | number | null;
  homeTimezone: string;
  notificationChannel: string;
  active: boolean;
}

export interface CreateUserRequestDto {
  name: string;
  email: string;
  role: string;
  skillKeys?: string[];
  certifiedLocationIds?: number[];
  managedLocationIds?: number[];
  desiredWeeklyHours?: number;
  hourlyRate?: number;
  homeTimezone: string;
  notificationChannel?: string;
}

export type UpdateUserRequestDto = Partial<CreateUserRequestDto>;

export const usersApi = {
  list: () => get<UserDto[]>("/users"),
  get: (id: number) => get<UserDto>(`/users/${id}`),
  create: (body: CreateUserRequestDto) => post<UserDto>("/users", body),
  update: (id: number, body: UpdateUserRequestDto) => put<UserDto>(`/users/${id}`, body),
  setActive: (id: number, active: boolean) => patch<UserDto>(`/users/${id}/active`, { active }),
  /** Self-service only — updates the CALLING user's own notificationChannel.
   * Backed by PATCH /users/me/notification-preference, which (unlike every
   * other /users endpoint) isn't admin-gated. */
  updateMyNotificationPreference: (notificationChannel: string) =>
    patch<UserDto>("/users/me/notification-preference", { notificationChannel }),
};

// --- Locations / skills (read-only convenience routes) ---------------------

export interface LocationDto {
  id: number;
  name: string;
  city: string;
  timezone: string;
  active: boolean;
}

export interface SkillDto {
  id: number;
  key: string;
  label: string;
  colorHex: string | null;
}

export const locationsApi = {
  list: () => get<LocationDto[]>("/locations"),
};

export const skillsApi = {
  list: () => get<SkillDto[]>("/skills"),
};

// --- Setup (admin) -----------------------------------------------------

export interface LocationRequestDto {
  name: string;
  city?: string;
  timezone: string;
}

export interface SkillRequestDto {
  key: string;
  label: string;
  colorHex?: string;
}

export interface ThresholdsDto {
  minRestHours: number;
  dailyHardBlockHours: number;
  dailyWarningHours: number;
  weeklyWarningHours: number;
  weeklyFullTimeHours: number;
  maxPendingSwapsPerStaff: number;
  dropExpiryHoursBeforeShift: number;
  publishEditCutoffHours: number;
  sixthConsecutiveDayWarning: number;
  seventhConsecutiveDayBlock: number;
}

export const setupApi = {
  listSkills: () => get<SkillDto[]>("/setup/skills"),
  createSkill: (body: SkillRequestDto) => post<SkillDto>("/setup/skills", body),
  updateSkill: (id: number, body: SkillRequestDto) => put<SkillDto>(`/setup/skills/${id}`, body),
  deleteSkill: (id: number) => del<void>(`/setup/skills/${id}`),

  listLocations: () => get<LocationDto[]>("/setup/locations"),
  createLocation: (body: LocationRequestDto) => post<LocationDto>("/setup/locations", body),
  updateLocation: (id: number, body: LocationRequestDto) => put<LocationDto>(`/setup/locations/${id}`, body),
  deleteLocation: (id: number) => del<void>(`/setup/locations/${id}`),

  getThresholds: () => get<ThresholdsDto>("/setup/thresholds"),
  updateThresholds: (body: Partial<ThresholdsDto>) => put<ThresholdsDto>("/setup/thresholds", body),

  timezones: () => get<string[]>("/setup/timezones"),
};

// --- Shifts --------------------------------------------------------------

export interface AssignedStaffDto {
  userId: number;
  name: string;
  avatarColor: string;
}

export interface ShiftDto {
  id: number;
  locationId: number;
  locationName: string;
  locationTimezone: string;
  skillId: number;
  skillKey: string;
  skillLabel: string;
  headcountNeeded: number;
  startUtc: string;
  endUtc: string;
  status: string;
  premium: boolean;
  notes: string | null;
  version: number;
  assignedStaff: AssignedStaffDto[];
}

export interface CreateShiftRequestDto {
  locationId: number;
  skillId: number;
  headcountNeeded: number;
  startUtc: string;
  endUtc: string;
  notes?: string;
}

export interface UpdateShiftRequestDto {
  locationId?: number;
  skillId?: number;
  headcountNeeded?: number;
  startUtc?: string;
  endUtc?: string;
  notes?: string;
  expectedVersion?: number;
  overrideCutoff?: boolean;
  overrideReason?: string;
}

export const shiftsApi = {
  get: (id: number) => get<ShiftDto>(`/shifts/${id}`),
  listByLocation: (locationId: number, weekStartUtc?: string) =>
    get<ShiftDto[]>(`/locations/${locationId}/shifts`, { weekStartUtc }),
  listForUser: (userId: number) => get<ShiftDto[]>(`/users/${userId}/shifts`),
  create: (body: CreateShiftRequestDto) => post<ShiftDto>("/shifts", body),
  update: (id: number, body: UpdateShiftRequestDto) => put<ShiftDto>(`/shifts/${id}`, body),
  publish: (id: number, expectedVersion?: number) =>
    post<ShiftDto>(`/shifts/${id}/publish`, undefined, { expectedVersion }),
  unpublish: (id: number, opts?: { expectedVersion?: number; overrideCutoff?: boolean; overrideReason?: string }) =>
    post<ShiftDto>(`/shifts/${id}/unpublish`, undefined, opts),
  publishWeek: (locationId: number, weekStartUtc: string) =>
    post<ShiftDto[]>(`/locations/${locationId}/schedule/publish-week`, undefined, { weekStartUtc }),
  checkAssignment: (id: number, userId: number) =>
    post<AssignmentCheckDto>(`/shifts/${id}/check-assignment`, undefined, { userId }),
  assign: (id: number, body: { userId: number; expectedVersion?: number; override?: boolean; overrideReason?: string }) =>
    post<ShiftDto>(`/shifts/${id}/assign`, body),
  unassign: (id: number, body: { userId: number; expectedVersion?: number }) =>
    post<ShiftDto>(`/shifts/${id}/unassign`, body),
  delete: (id: number) => del<void>(`/shifts/${id}`),
};

// --- Swaps -----------------------------------------------------------------

export interface SwapHistoryEntryDto {
  atUtc: string;
  event: string;
  byUserId: number | null;
}

export interface SwapDto {
  id: number;
  kind: string;
  shiftId: number;
  requestedByUserId: number;
  requestedByName: string;
  partnerUserId: number | null;
  partnerName: string | null;
  status: string;
  createdAtUtc: string;
  resolvedAtUtc: string | null;
  expiresAtUtc: string | null;
  history: SwapHistoryEntryDto[];
}

export const swapsApi = {
  forShift: (shiftId: number) => get<SwapDto[]>(`/swaps/shift/${shiftId}`),
  pendingApprovals: () => get<SwapDto[]>("/swaps/pending-approvals"),
  pendingCount: () => get<number>("/swaps/pending-count"),
  /** Additive read endpoints (not in the original backend) needed by the
   * Marketplace page — see SwapController for the implementation. */
  open: () => get<SwapDto[]>("/swaps/open"),
  mine: () => get<SwapDto[]>("/swaps/mine"),

  requestSwap: (shiftId: number, partnerUserId: number) =>
    post<SwapDto>("/swaps/request-swap", { shiftId, partnerUserId }),
  requestDrop: (shiftId: number) => post<SwapDto>("/swaps/request-drop", { shiftId }),
  partnerAccept: (id: number) => post<SwapDto>(`/swaps/${id}/partner-accept`),
  pickUp: (id: number) => post<SwapDto>(`/swaps/${id}/pick-up`),
  managerApprove: (id: number) => post<SwapDto>(`/swaps/${id}/manager-approve`),
  managerReject: (id: number, reason: string) => post<SwapDto>(`/swaps/${id}/manager-reject`, { reason }),
  cancel: (id: number) => post<SwapDto>(`/swaps/${id}/cancel`),
};

// --- Availability ------------------------------------------------------

export interface AvailabilityDto {
  id: number;
  userId: number;
  type: string;
  dayOfWeek: number | null;
  date: string | null;
  startMinutes: number;
  endMinutes: number;
  available: boolean;
}

export const availabilityApi = {
  forUser: (userId: number) => get<AvailabilityDto[]>(`/users/${userId}/availability`),
  setRecurring: (userId: number, dayOfWeek: number, startMinutes: number, endMinutes: number) =>
    put<AvailabilityDto>(`/users/${userId}/availability/recurring`, { dayOfWeek, startMinutes, endMinutes }),
  clearRecurring: (userId: number, dayOfWeek: number) =>
    del<void>(`/users/${userId}/availability/recurring/${dayOfWeek}`),
  addException: (userId: number, date: string, available: boolean) =>
    post<AvailabilityDto>(`/users/${userId}/availability/exceptions`, { date, available }),
  removeException: (userId: number, id: number) =>
    del<void>(`/users/${userId}/availability/exceptions/${id}`),
};

// --- Notifications -------------------------------------------------------

export interface NotificationDto {
  id: number;
  type: string;
  title: string;
  body: string;
  linkShiftId: number | null;
  linkSwapId: number | null;
  createdAt: string;
  read: boolean;
}

export const notificationsApi = {
  list: () => get<NotificationDto[]>("/notifications"),
  unreadCount: () => get<{ count: number }>("/notifications/unread-count"),
  markRead: (id: number) => patch<void>(`/notifications/${id}/read`),
  markAllRead: () => post<void>("/notifications/read-all"),
};

// --- Presence --------------------------------------------------------------

export interface ClockRecordDto {
  id: number;
  userId: number;
  userName: string;
  shiftId: number;
  locationId: number;
  clockInUtc: string;
  clockOutUtc: string | null;
}

export const presenceApi = {
  onDutyAt: (locationId: number) => get<ClockRecordDto[]>(`/locations/${locationId}/on-duty`),
  clockIn: (shiftId: number) => post<ClockRecordDto>(`/shifts/${shiftId}/clock-in`),
  clockOut: (shiftId: number) => post<ClockRecordDto>(`/shifts/${shiftId}/clock-out`),
};

// --- Audit -------------------------------------------------------------

export interface AuditEntryDto {
  id: number;
  atUtc: string;
  actorUserId: number;
  actorName: string;
  entityType: string;
  entityId: string;
  action: string;
  locationId: number | null;
  before: string | null;
  after: string | null;
}

export interface PageDto<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export const auditApi = {
  search: (params: { from?: string; to?: string; locationId?: number; page?: number; size?: number }) =>
    get<PageDto<AuditEntryDto>>("/audit", params),
  history: (entityType: string, entityId: string) =>
    get<AuditEntryDto[]>(`/audit/entity/${entityType}/${entityId}`),
  /** CSV export needs the Authorization header, so it can't be a plain
   * <a href>; fetch it as a blob and hand the browser a download. */
  exportCsv: async (params: { from?: string; to?: string; locationId?: number }): Promise<Blob> => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/audit/export${toQueryString(params)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiRequestError("Couldn't export the audit log.", res.status);
    return res.blob();
  },
};

// --- Analytics ---------------------------------------------------------

export interface DistributionEntryDto {
  userId: number;
  name: string;
  hoursWorked: number;
  desiredWeeklyHours: number | null;
  premiumShiftsWorked: number;
  totalShiftsWorked: number;
}

export interface FairnessReportDto {
  locationId: number;
  from: string;
  to: string;
  fairnessScore: number;
  entries: DistributionEntryDto[];
  note: string | null;
}

export interface OvertimeEntryDto {
  userId: number;
  name: string;
  hoursScheduled: number;
  hourlyRate: string | number | null;
  projectedRegularCost: string | number;
  projectedOvertimeCost: string | number;
  overWeeklyThreshold: boolean;
}

export interface OvertimeReportDto {
  locationId: number;
  weekStart: string;
  totalProjectedCost: string | number;
  entries: OvertimeEntryDto[];
}

export const analyticsApi = {
  distribution: (locationId: number, from: string, to: string) =>
    get<FairnessReportDto>(`/analytics/locations/${locationId}/distribution`, { from, to }),
  overtime: (locationId: number, weekStartUtc: string) =>
    get<OvertimeReportDto>(`/analytics/locations/${locationId}/overtime`, { weekStartUtc }),
};
