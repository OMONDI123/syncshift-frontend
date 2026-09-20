/**
 * Converts backend wire DTOs (numeric ids, UPPERCASE enums — see
 * `lib/api.ts`) into the frontend's existing domain types
 * (`types/index.ts`, string ids, lowercase enums). Keeping this in one
 * place means every page/component written against `types/index.ts`
 * during Phase 1 keeps working unmodified against real data.
 */
import type {
  AppNotification,
  AssignmentCheck,
  AuditLogEntry,
  AvailabilityWindow,
  ClockRecord,
  NotificationKind,
  Shift,
  ShiftStatus,
  SwapKind,
  SwapRequest,
  SwapStatus,
  User,
  ViolationCode,
} from "@/types";
import type {
  AssignmentCheckDto,
  AuditEntryDto,
  AvailabilityDto,
  ClockRecordDto,
  NotificationDto,
  ShiftDto,
  SwapDto,
  UserDto,
} from "@/lib/api";
import type { SkillDef } from "@/store/settingsStore";
import type { Location } from "@/types";
import type { LocationDto, SkillDto } from "@/lib/api";

const id = (n: number | string) => String(n);

const SHIFT_STATUS: Record<string, ShiftStatus> = { DRAFT: "draft", PUBLISHED: "published" };

const SWAP_STATUS: Record<string, SwapStatus> = {
  PENDING_PARTNER: "pending_partner",
  OPEN: "open",
  PENDING_MANAGER: "pending_manager",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
};

const SWAP_KIND: Record<string, SwapKind> = { SWAP: "swap", DROP: "drop" };

const NOTIFICATION_KIND: Record<string, NotificationKind> = {
  SHIFT_ASSIGNED: "shift_assigned",
  SHIFT_CHANGED: "shift_changed",
  SHIFT_UNASSIGNED: "shift_changed",
  SCHEDULE_PUBLISHED: "schedule_published",
  SWAP_REQUESTED: "swap_update",
  SWAP_ACCEPTED: "swap_update",
  SWAP_APPROVED: "swap_update",
  SWAP_REJECTED: "swap_update",
  SWAP_CANCELLED: "swap_update",
  DROP_POSTED: "swap_update",
  DROP_CLAIMED: "swap_update",
  DROP_EXPIRED: "swap_update",
  AVAILABILITY_CHANGED: "availability_changed",
  OVERTIME_WARNING: "overtime_warning",
  APPROVAL_NEEDED: "approval_needed",
};

export function mapLocation(dto: LocationDto): Location {
  return { id: id(dto.id), name: dto.name, city: dto.city ?? "", timezone: dto.timezone };
}

/** SkillDef keeps the backend's numeric id (needed for PUT/DELETE on the
 * Setup page) alongside the string `key` the rest of the app already uses
 * as `Skill`/`skillRequired`. */
export function mapSkill(dto: SkillDto): SkillDef & { backendId: number } {
  return { id: dto.key, label: dto.label, color: dto.colorHex || "#6B7280", backendId: dto.id };
}

export function mapUser(dto: UserDto): User {
  return {
    id: id(dto.id),
    name: dto.name,
    email: dto.email,
    role: dto.role as User["role"],
    avatarColor: dto.avatarColor,
    skills: dto.skills,
    certifiedLocationIds: dto.certifiedLocationIds.map(id),
    managedLocationIds: dto.managedLocationIds.map(id),
    desiredWeeklyHours: dto.desiredWeeklyHours ?? undefined,
    homeTimezone: dto.homeTimezone,
    notificationChannel: (dto.notificationChannel as User["notificationChannel"]) ?? "IN_APP_ONLY",
    active: dto.active,
  };
}

export function mapShift(dto: ShiftDto): Shift {
  return {
    id: id(dto.id),
    locationId: id(dto.locationId),
    skillRequired: dto.skillKey,
    headcountNeeded: dto.headcountNeeded,
    startUtc: dto.startUtc,
    endUtc: dto.endUtc,
    status: SHIFT_STATUS[dto.status] ?? "draft",
    assignedUserIds: dto.assignedStaff.map((a) => id(a.userId)),
    isPremium: dto.premium,
    notes: dto.notes ?? undefined,
    version: dto.version,
  };
}

export function mapSwap(dto: SwapDto): SwapRequest {
  return {
    id: id(dto.id),
    kind: SWAP_KIND[dto.kind] ?? "swap",
    shiftId: id(dto.shiftId),
    requestedByUserId: id(dto.requestedByUserId),
    partnerUserId: dto.partnerUserId !== null ? id(dto.partnerUserId) : undefined,
    status: SWAP_STATUS[dto.status] ?? "cancelled",
    createdAtUtc: dto.createdAtUtc,
    resolvedAtUtc: dto.resolvedAtUtc ?? undefined,
    expiresAtUtc: dto.expiresAtUtc ?? undefined,
    history: dto.history.map((h) => ({
      atUtc: h.atUtc,
      event: h.event,
      byUserId: h.byUserId !== null ? id(h.byUserId) : undefined,
    })),
  };
}

export function mapNotification(dto: NotificationDto, currentUserId: string): AppNotification {
  return {
    id: id(dto.id),
    userId: currentUserId,
    kind: NOTIFICATION_KIND[dto.type] ?? "conflict",
    title: dto.title,
    body: dto.body,
    createdAtUtc: dto.createdAt,
    read: dto.read,
    linkShiftId: dto.linkShiftId !== null ? id(dto.linkShiftId) : undefined,
  };
}

export function mapClockRecord(dto: ClockRecordDto): ClockRecord {
  return {
    id: id(dto.id),
    userId: id(dto.userId),
    shiftId: id(dto.shiftId),
    locationId: id(dto.locationId),
    clockInUtc: dto.clockInUtc,
    clockOutUtc: dto.clockOutUtc ?? undefined,
  };
}

export function mapAvailability(dto: AvailabilityDto): AvailabilityWindow {
  return {
    id: id(dto.id),
    userId: id(dto.userId),
    type: dto.type === "RECURRING" ? "recurring" : "exception",
    dayOfWeek: dto.dayOfWeek ?? undefined,
    date: dto.date ?? undefined,
    startMinutes: dto.startMinutes,
    endMinutes: dto.endMinutes,
    available: dto.available,
  };
}

export function mapAuditEntry(dto: AuditEntryDto): AuditLogEntry {
  return {
    id: id(dto.id),
    atUtc: dto.atUtc,
    actorUserId: id(dto.actorUserId),
    entity: dto.entityType.toLowerCase() as AuditLogEntry["entity"],
    entityId: dto.entityId,
    action: dto.action,
    before: safeParse(dto.before),
    after: safeParse(dto.after),
  };
}

/** The backend's ViolationCode/Severity enums were deliberately kept as an
 * exact 1:1 match with the frontend's original union (see the backend's
 * own doc comment on `ViolationCode`), so this mapping is just a case
 * change, not a translation table. */
export function mapAssignmentCheck(dto: AssignmentCheckDto): AssignmentCheck {
  return {
    ok: dto.ok,
    violations: dto.violations.map((v) => ({
      code: v.code as ViolationCode,
      severity: v.severity.toLowerCase() as "block" | "warning",
      message: v.message,
    })),
    suggestions: dto.suggestions.map((s) => ({ userId: id(s.userId), reason: s.reason })),
  };
}

function safeParse(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
