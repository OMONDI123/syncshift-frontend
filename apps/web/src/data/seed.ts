import { addDays, addHours, startOfWeek } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import type {
  AppNotification,
  AuditLogEntry,
  AvailabilityWindow,
  Location,
  Shift,
  SwapRequest,
  User,
} from "@/types";

export const locations: Location[] = [
  { id: "loc-sea", name: "Seattle Harbor", city: "Seattle, WA", timezone: "America/Los_Angeles" },
  { id: "loc-pdx", name: "Portland Pearl", city: "Portland, OR", timezone: "America/Los_Angeles" },
  { id: "loc-mia", name: "Miami Shore", city: "Miami, FL", timezone: "America/New_York" },
  { id: "loc-bos", name: "Boston Wharf", city: "Boston, MA", timezone: "America/New_York" },
];

export const users: User[] = [
  {
    id: "u-admin",
    name: "Dana Reyes",
    email: "dana@coastaleats.com",
    role: "ADMIN",
    avatarColor: "#0F2148",
    skills: [],
    certifiedLocationIds: [],
    managedLocationIds: [],
    homeTimezone: "America/Los_Angeles",
    notificationChannel: "IN_APP_ONLY",
    active: true,
  },
  {
    id: "u-mgr-west",
    name: "Marcus Chen",
    email: "marcus@coastaleats.com",
    role: "MANAGER",
    avatarColor: "#14264D",
    skills: [],
    certifiedLocationIds: [],
    managedLocationIds: ["loc-sea", "loc-pdx"],
    homeTimezone: "America/Los_Angeles",
    notificationChannel: "IN_APP_ONLY",
    active: true,
  },
  {
    id: "u-mgr-east",
    name: "Priya Nair",
    email: "priya@coastaleats.com",
    role: "MANAGER",
    avatarColor: "#1B3163",
    skills: [],
    certifiedLocationIds: [],
    managedLocationIds: ["loc-mia", "loc-bos"],
    homeTimezone: "America/New_York",
    notificationChannel: "IN_APP_ONLY",
    active: true,
  },
  // Staff — West coast
  {
    id: "u-sarah",
    name: "Sarah Kim",
    email: "sarah@coastaleats.com",
    role: "STAFF",
    avatarColor: "#F5A623",
    skills: ["bartender", "server"],
    certifiedLocationIds: ["loc-sea", "loc-pdx"],
    managedLocationIds: [],
    desiredWeeklyHours: 30,
    homeTimezone: "America/Los_Angeles",
    notificationChannel: "IN_APP_ONLY",
    active: true,
  },
  {
    id: "u-john",
    name: "John Alvarez",
    email: "john@coastaleats.com",
    role: "STAFF",
    avatarColor: "#2FAE66",
    skills: ["bartender", "server", "host"],
    certifiedLocationIds: ["loc-sea"],
    managedLocationIds: [],
    desiredWeeklyHours: 35,
    homeTimezone: "America/Los_Angeles",
    notificationChannel: "IN_APP_ONLY",
    active: true,
  },
  {
    id: "u-maria",
    name: "Maria Gonzalez",
    email: "maria@coastaleats.com",
    role: "STAFF",
    avatarColor: "#E5484D",
    skills: ["line_cook", "prep_cook"],
    certifiedLocationIds: ["loc-sea", "loc-pdx"],
    managedLocationIds: [],
    desiredWeeklyHours: 32,
    homeTimezone: "America/Los_Angeles",
    notificationChannel: "IN_APP_ONLY",
    active: true,
  },
  {
    id: "u-noah",
    name: "Noah Park",
    email: "noah@coastaleats.com",
    role: "STAFF",
    avatarColor: "#F0A93A",
    skills: ["host", "server"],
    certifiedLocationIds: ["loc-pdx"],
    managedLocationIds: [],
    desiredWeeklyHours: 20,
    homeTimezone: "America/Los_Angeles",
    notificationChannel: "IN_APP_ONLY",
    active: true,
  },
  // Staff — East coast
  {
    id: "u-liam",
    name: "Liam O'Brien",
    email: "liam@coastaleats.com",
    role: "STAFF",
    avatarColor: "#DB8F14",
    skills: ["bartender", "server"],
    certifiedLocationIds: ["loc-bos", "loc-mia"],
    managedLocationIds: [],
    desiredWeeklyHours: 34,
    homeTimezone: "America/New_York",
    notificationChannel: "IN_APP_ONLY",
    active: true,
  },
  {
    id: "u-ava",
    name: "Ava Thompson",
    email: "ava@coastaleats.com",
    role: "STAFF",
    avatarColor: "#8A93A8",
    skills: ["line_cook"],
    certifiedLocationIds: ["loc-mia"],
    managedLocationIds: [],
    desiredWeeklyHours: 40,
    homeTimezone: "America/New_York",
    notificationChannel: "IN_APP_ONLY",
    active: true,
  },
  {
    id: "u-diego",
    name: "Diego Ramirez",
    email: "diego@coastaleats.com",
    role: "STAFF",
    avatarColor: "#4B5468",
    skills: ["server", "host"],
    certifiedLocationIds: ["loc-bos"],
    managedLocationIds: [],
    desiredWeeklyHours: 25,
    homeTimezone: "America/New_York",
    notificationChannel: "IN_APP_ONLY",
    active: true,
  },
  // Staff certified cross-country — the "Timezone Tangle" case:
  // certified at a Pacific location AND an Eastern location.
  {
    id: "u-jordan",
    name: "Jordan Blake",
    email: "jordan@coastaleats.com",
    role: "STAFF",
    avatarColor: "#F5A623",
    skills: ["bartender", "server"],
    certifiedLocationIds: ["loc-sea", "loc-mia"],
    managedLocationIds: [],
    desiredWeeklyHours: 30,
    homeTimezone: "America/Los_Angeles",
    notificationChannel: "IN_APP_ONLY",
    active: true,
  },
];

// --- Availability -----------------------------------------------------
// Jordan sets "9am-5pm" availability. Per our design decision (documented
// in README "Ambiguities"), a recurring availability window is anchored to
// the STAFF member's declared home timezone, not each location's timezone —
// otherwise "9am-5pm" would silently mean two different things depending on
// which location's shift is being checked. Jordan's home tz is Pacific.
export const availability: AvailabilityWindow[] = [
  ...[1, 2, 3, 4, 5].map((dow, i) => ({
    id: `avail-sarah-${i}`,
    userId: "u-sarah",
    type: "recurring" as const,
    dayOfWeek: dow,
    startMinutes: 16 * 60,
    endMinutes: 23 * 60 + 59,
    available: true,
  })),
  ...[0, 5, 6].map((dow, i) => ({
    id: `avail-john-${i}`,
    userId: "u-john",
    type: "recurring" as const,
    dayOfWeek: dow,
    startMinutes: 10 * 60,
    endMinutes: 23 * 60,
    available: true,
  })),
  ...[1, 2, 3, 4, 5, 6].map((dow, i) => ({
    id: `avail-maria-${i}`,
    userId: "u-maria",
    type: "recurring" as const,
    dayOfWeek: dow,
    startMinutes: 8 * 60,
    endMinutes: 20 * 60,
    available: true,
  })),
  ...[0, 1, 2, 3, 4, 5, 6].map((dow, i) => ({
    id: `avail-jordan-${i}`,
    userId: "u-jordan",
    type: "recurring" as const,
    dayOfWeek: dow,
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
    available: true,
  })),
  ...[3, 4, 5, 6].map((dow, i) => ({
    id: `avail-liam-${i}`,
    userId: "u-liam",
    type: "recurring" as const,
    dayOfWeek: dow,
    startMinutes: 14 * 60,
    endMinutes: 23 * 60 + 59,
    available: true,
  })),
  ...[1, 2, 3, 4, 5].map((dow, i) => ({
    id: `avail-ava-${i}`,
    userId: "u-ava",
    type: "recurring" as const,
    dayOfWeek: dow,
    startMinutes: 7 * 60,
    endMinutes: 19 * 60,
    available: true,
  })),
  ...[4, 5, 6].map((dow, i) => ({
    id: `avail-diego-${i}`,
    userId: "u-diego",
    type: "recurring" as const,
    dayOfWeek: dow,
    startMinutes: 12 * 60,
    endMinutes: 23 * 60,
    available: true,
  })),
  ...[5, 6].map((dow, i) => ({
    id: `avail-noah-${i}`,
    userId: "u-noah",
    type: "recurring" as const,
    dayOfWeek: dow,
    startMinutes: 15 * 60,
    endMinutes: 22 * 60,
    available: true,
  })),
];

// --- Shifts -------------------------------------------------------------
const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 }); // Sunday

function shiftAt(
  locationId: string,
  tz: string,
  dayOffset: number,
  startHour: number,
  durationHours: number,
  skillRequired: Shift["skillRequired"],
  headcountNeeded: number,
  assignedUserIds: string[],
  opts: Partial<Shift> = {},
): Shift {
  const day = addDays(weekStart, dayOffset);
  const localStart = new Date(day);
  localStart.setHours(startHour, 0, 0, 0);
  const startUtc = fromZonedTime(localStart, tz).toISOString();
  const endUtc = addHours(new Date(startUtc), durationHours).toISOString();
  const isPremium = (dayOffset === 5 || dayOffset === 6) && startHour >= 17;
  return {
    id: `shift-${locationId}-${dayOffset}-${startHour}-${Math.random().toString(36).slice(2, 7)}`,
    locationId,
    skillRequired,
    headcountNeeded,
    startUtc,
    endUtc,
    status: "published",
    assignedUserIds,
    isPremium,
    version: 1,
    ...opts,
  };
}

export const shifts: Shift[] = [
  // --- Seattle Harbor (Pacific) ---
  shiftAt("loc-sea", "America/Los_Angeles", 0, 17, 6, "server", 1, ["u-sarah"]),
  shiftAt("loc-sea", "America/Los_Angeles", 0, 23, 4, "bartender", 1, ["u-john"], {
    // an overnight shift: 11pm -> 3am, exercises the overnight-shift rule
  }),
  shiftAt("loc-sea", "America/Los_Angeles", 3, 16, 5, "bartender", 1, ["u-sarah"]),
  // Sunday-night coverage gap scenario: this shift will be "called out" via
  // the demo — seeded fully staffed, the Marketplace page seeds a live drop.
  shiftAt("loc-sea", "America/Los_Angeles", 0, 19, 4, "server", 1, ["u-john"]),
  shiftAt("loc-sea", "America/Los_Angeles", 5, 18, 5, "server", 2, ["u-sarah", "u-john"]),
  shiftAt("loc-sea", "America/Los_Angeles", 6, 17, 5, "bartender", 1, ["u-jordan"]),

  // --- Portland Pearl (Pacific) ---
  shiftAt("loc-pdx", "America/Los_Angeles", 1, 11, 6, "line_cook", 1, ["u-maria"]),
  shiftAt("loc-pdx", "America/Los_Angeles", 2, 11, 6, "line_cook", 1, ["u-maria"]),
  shiftAt("loc-pdx", "America/Los_Angeles", 3, 11, 6, "line_cook", 1, ["u-maria"]),
  shiftAt("loc-pdx", "America/Los_Angeles", 4, 11, 6, "line_cook", 1, ["u-maria"]),
  shiftAt("loc-pdx", "America/Los_Angeles", 5, 11, 7, "line_cook", 1, ["u-maria"]),
  // Deliberate near-miss: Maria's 6th consecutive day if Saturday is added.
  // Left unassigned on purpose so a manager assigning it triggers the warning.
  shiftAt("loc-pdx", "America/Los_Angeles", 6, 11, 7, "line_cook", 1, []),
  shiftAt("loc-pdx", "America/Los_Angeles", 5, 17, 5, "host", 1, ["u-noah"]),
  shiftAt("loc-pdx", "America/Los_Angeles", 6, 17, 5, "host", 1, ["u-noah"]),

  // --- Miami Shore (Eastern) ---
  shiftAt("loc-mia", "America/New_York", 1, 10, 8, "line_cook", 1, ["u-ava"]),
  shiftAt("loc-mia", "America/New_York", 2, 10, 8, "line_cook", 1, ["u-ava"]),
  shiftAt("loc-mia", "America/New_York", 3, 10, 8, "line_cook", 1, ["u-ava"]),
  shiftAt("loc-mia", "America/New_York", 4, 10, 8, "line_cook", 1, ["u-ava"]),
  shiftAt("loc-mia", "America/New_York", 5, 10, 8, "line_cook", 1, ["u-ava"]),
  // Ava is already at 40h — the Overtime Trap scenario: adding Saturday
  // would push her to 48-52h and should be flagged before confirmation.
  shiftAt("loc-mia", "America/New_York", 6, 10, 8, "line_cook", 1, []),
  shiftAt("loc-mia", "America/New_York", 5, 18, 5, "bartender", 1, ["u-jordan"]),
  shiftAt("loc-mia", "America/New_York", 6, 18, 5, "bartender", 1, []),

  // --- Boston Wharf (Eastern) ---
  shiftAt("loc-bos", "America/New_York", 3, 14, 6, "server", 1, ["u-liam"]),
  shiftAt("loc-bos", "America/New_York", 4, 14, 6, "server", 1, ["u-liam"]),
  shiftAt("loc-bos", "America/New_York", 5, 17, 6, "server", 2, ["u-liam", "u-diego"]),
  shiftAt("loc-bos", "America/New_York", 6, 17, 6, "host", 1, ["u-diego"]),
];

// The unfilled Saturday Miami bartender shift, used as the "simultaneous
// assignment" collision target between the two managers in the demo.
export const collisionShiftId = shifts.find(
  (s) => s.locationId === "loc-mia" && s.skillRequired === "bartender" && s.assignedUserIds.length === 0,
)!.id;

// The Sunday 7pm Seattle server shift used for the "Sunday Night Chaos" demo.
export const sundayChaosShiftId = shifts.find(
  (s) => s.locationId === "loc-sea" && s.assignedUserIds.includes("u-john") && new Date(s.startUtc).getUTCHours() !== 23,
)!.id;

export const swapRequests: SwapRequest[] = [
  {
    id: "swap-1",
    kind: "swap",
    shiftId: shifts[4].id, // Sarah/John Fri Seattle double-server shift
    requestedByUserId: "u-sarah",
    partnerUserId: "u-jordan",
    status: "pending_manager",
    createdAtUtc: new Date().toISOString(),
    history: [
      { atUtc: new Date().toISOString(), event: "Sarah requested a swap with Jordan", byUserId: "u-sarah" },
      { atUtc: new Date().toISOString(), event: "Jordan accepted", byUserId: "u-jordan" },
    ],
  },
];

export const notifications: AppNotification[] = [
  {
    id: "notif-1",
    userId: "u-mgr-west",
    kind: "approval_needed",
    title: "Swap needs your approval",
    body: "Sarah Kim ↔ Jordan Blake for Friday's Seattle Harbor server shift.",
    createdAtUtc: new Date().toISOString(),
    read: false,
    linkShiftId: shifts[4].id,
  },
  {
    id: "notif-2",
    userId: "u-mgr-east",
    kind: "overtime_warning",
    title: "Overtime risk this week",
    body: "Ava Thompson is projected at 48 hours if Saturday's shift is confirmed.",
    createdAtUtc: new Date().toISOString(),
    read: false,
  },
  {
    id: "notif-3",
    userId: "u-john",
    kind: "schedule_published",
    title: "This week's schedule is live",
    body: "Seattle Harbor's schedule was published by Marcus Chen.",
    createdAtUtc: new Date().toISOString(),
    read: true,
  },
];

export const auditLog: AuditLogEntry[] = [
  {
    id: "audit-1",
    atUtc: new Date().toISOString(),
    actorUserId: "u-mgr-west",
    entity: "shift",
    entityId: shifts[0].id,
    action: "published_week",
  },
];
