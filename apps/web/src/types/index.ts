// Domain types for ShiftSync.
// Timezone rule: every timestamp is stored as an ISO-8601 UTC instant.
// Components convert to a location's IANA zone only at render time —
// never store or compare "local" wall-clock strings.

export type Role = "ADMIN" | "MANAGER" | "STAFF";

/** How a user wants to be reached for notifications — mirrors the backend's
 * NotificationChannel enum verbatim (kept uppercase, same convention as
 * Role, rather than lowercased like the internal display-only unions
 * below). Email is simulated (logged server-side), never actually sent. */
export type NotificationChannel = "IN_APP_ONLY" | "IN_APP_AND_EMAIL";

/**
 * Skills are an admin-managed catalog (see settingsStore), not a fixed set —
 * this is just the id of a SkillDef. It stays a plain string rather than a
 * union so a newly added skill type-checks everywhere without a code change.
 */
export type Skill = string;

export interface Location {
  id: string;
  name: string;
  city: string;
  timezone: string; // IANA, e.g. "America/Los_Angeles"
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarColor: string; // deterministic accent for avatar initials
  skills: Skill[];
  certifiedLocationIds: string[];
  managedLocationIds: string[]; // only relevant for MANAGER
  desiredWeeklyHours?: number; // used by fairness analytics
  /** IANA timezone this person's own clock/availability is anchored to —
   * independent of any location's timezone. See constraints.ts. */
  homeTimezone: string;
  /** Requirement #7: "Users configure their notification preferences
   * (in-app only, or in-app + email simulation)." Self-editable via
   * usersApi.updateMyNotificationPreference — see NotificationCenter. */
  notificationChannel: NotificationChannel;
  /** Deactivated accounts are kept (never deleted) so historical shift and
   * audit records stay intact, but can no longer sign in or be assigned. */
  active: boolean;
}

export interface AvailabilityWindow {
  id: string;
  userId: string;
  // recurring: dayOfWeek 0=Sunday .. 6=Saturday, times are in the STAFF's
  // home reference but re-evaluated per-location timezone at scheduling time
  type: "recurring" | "exception";
  dayOfWeek?: number;
  date?: string; // ISO date, for one-off exceptions
  startMinutes: number; // minutes from local midnight
  endMinutes: number;
  available: boolean; // false = explicit "unavailable" exception
}

export type ShiftStatus = "draft" | "published";

export interface Shift {
  id: string;
  locationId: string;
  skillRequired: Skill;
  headcountNeeded: number;
  startUtc: string; // ISO instant
  endUtc: string; // ISO instant
  status: ShiftStatus;
  assignedUserIds: string[];
  isPremium: boolean; // Fri/Sat evening
  notes?: string;
  /** Optimistic-concurrency counter. Bumped on every mutation so two managers
   * acting on the same shift at once can be detected instead of silently
   * clobbering each other — see scheduleStore.assignUser. */
  version: number;
}

export type SwapKind = "swap" | "drop";
export type SwapStatus =
  | "pending_partner" // swap only: waiting on Staff B
  | "open" // drop only: up for grabs, no picker yet
  | "pending_manager" // waiting on manager approval
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired";

export interface SwapRequest {
  id: string;
  kind: SwapKind;
  shiftId: string;
  requestedByUserId: string;
  partnerUserId?: string; // swap: the accepting partner. drop: the staff who picked it up
  status: SwapStatus;
  createdAtUtc: string;
  resolvedAtUtc?: string;
  expiresAtUtc?: string; // drop requests: 24h before shift start
  history: { atUtc: string; event: string; byUserId?: string }[];
}

export type NotificationKind =
  | "shift_assigned"
  | "shift_changed"
  | "schedule_published"
  | "swap_update"
  | "approval_needed"
  | "overtime_warning"
  | "availability_changed"
  | "conflict";

export interface AppNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAtUtc: string;
  read: boolean;
  linkShiftId?: string;
}

export interface AuditLogEntry {
  id: string;
  atUtc: string;
  actorUserId: string;
  entity: "shift" | "swap" | "availability" | "user" | "security" | "settings" | "location";
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}

export interface ClockRecord {
  id: string;
  userId: string;
  shiftId: string;
  locationId: string;
  clockInUtc: string;
  clockOutUtc?: string;
}

export interface Session {
  token: string;
  userId: string;
  issuedAtUtc: string;
  expiresAtUtc: string;
}

export type ViolationCode =
  | "DOUBLE_BOOKED"
  | "REST_PERIOD"
  | "SKILL_MISMATCH"
  | "LOCATION_NOT_CERTIFIED"
  | "OUTSIDE_AVAILABILITY"
  | "DAILY_HOURS_BLOCK"
  | "SEVENTH_CONSECUTIVE_DAY";

export interface ConstraintViolation {
  code: ViolationCode;
  severity: "block" | "warning";
  message: string;
}

export interface AssignmentCheck {
  ok: boolean;
  violations: ConstraintViolation[];
  suggestions: { userId: string; reason: string }[];
}
