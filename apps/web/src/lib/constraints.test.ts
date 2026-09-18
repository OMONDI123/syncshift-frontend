import { describe, expect, it } from "vitest";
import { checkAssignment } from "@/lib/constraints";
import type { AvailabilityWindow, Location, Shift, User } from "@/types";

const seattle: Location = { id: "loc-a", name: "Seattle Harbor", city: "Seattle", timezone: "America/Los_Angeles" };
const portland: Location = { id: "loc-b", name: "Portland Pearl", city: "Portland", timezone: "America/Los_Angeles" };
const locationsById = { [seattle.id]: seattle, [portland.id]: portland };

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u-1",
    name: "Test Staffer",
    email: "test@coastaleats.com",
    role: "STAFF",
    avatarColor: "#000000",
    skills: ["server"],
    certifiedLocationIds: [seattle.id],
    managedLocationIds: [],
    homeTimezone: "America/Los_Angeles",
    active: true,
    ...overrides,
  };
}

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: "shift-1",
    locationId: seattle.id,
    skillRequired: "server",
    headcountNeeded: 1,
    startUtc: "2026-01-05T20:00:00.000Z", // Mon 12pm Pacific
    endUtc: "2026-01-06T02:00:00.000Z", // 6pm Pacific
    status: "published",
    assignedUserIds: [],
    isPremium: false,
    version: 1,
    ...overrides,
  };
}

function fullAvailability(userId: string): AvailabilityWindow[] {
  return Array.from({ length: 7 }, (_, dow) => ({
    id: `avail-${userId}-${dow}`,
    userId,
    type: "recurring" as const,
    dayOfWeek: dow,
    startMinutes: 0,
    endMinutes: 24 * 60 - 1,
    available: true,
  }));
}

describe("checkAssignment", () => {
  it("passes a fully eligible, available staff member", () => {
    const user = makeUser();
    const shift = makeShift();
    const result = checkAssignment(user, shift, [], locationsById, fullAvailability(user.id), [user], [shift]);
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("blocks when staff lacks the required skill", () => {
    const user = makeUser({ skills: ["host"] });
    const shift = makeShift({ skillRequired: "server" });
    const result = checkAssignment(user, shift, [], locationsById, fullAvailability(user.id), [user], [shift]);
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("SKILL_MISMATCH");
  });

  it("blocks when staff isn't certified at the shift's location", () => {
    const user = makeUser({ certifiedLocationIds: [portland.id] });
    const shift = makeShift({ locationId: seattle.id });
    const result = checkAssignment(user, shift, [], locationsById, fullAvailability(user.id), [user], [shift]);
    expect(result.violations.map((v) => v.code)).toContain("LOCATION_NOT_CERTIFIED");
  });

  it("blocks double-booking, including across two different locations", () => {
    const user = makeUser({ certifiedLocationIds: [seattle.id, portland.id] });
    const existing = makeShift({
      id: "shift-existing",
      locationId: portland.id,
      startUtc: "2026-01-05T21:00:00.000Z",
      endUtc: "2026-01-06T01:00:00.000Z",
    });
    const target = makeShift({ id: "shift-target", locationId: seattle.id });
    const result = checkAssignment(
      user,
      target,
      [existing],
      locationsById,
      fullAvailability(user.id),
      [user],
      [existing, target],
    );
    expect(result.violations.map((v) => v.code)).toContain("DOUBLE_BOOKED");
  });

  it("blocks when back-to-back shifts leave less than 10 hours rest", () => {
    const user = makeUser();
    const priorShift = makeShift({
      id: "shift-prior",
      startUtc: "2026-01-05T18:00:00.000Z",
      endUtc: "2026-01-06T02:00:00.000Z",
    });
    const target = makeShift({
      id: "shift-target",
      startUtc: "2026-01-06T06:00:00.000Z",
      endUtc: "2026-01-06T12:00:00.000Z",
    });
    const result = checkAssignment(
      user,
      target,
      [priorShift],
      locationsById,
      fullAvailability(user.id),
      [user],
      [priorShift, target],
    );
    expect(result.violations.map((v) => v.code)).toContain("REST_PERIOD");
  });

  it("honors a custom, admin-configured minimum rest threshold", () => {
    // Same 4-hour gap as the test above, which blocks against the 10-hour
    // default — but an org that only requires 3 hours of rest should allow it.
    const user = makeUser();
    const priorShift = makeShift({
      id: "shift-prior",
      startUtc: "2026-01-05T18:00:00.000Z",
      endUtc: "2026-01-06T02:00:00.000Z",
    });
    const target = makeShift({
      id: "shift-target",
      startUtc: "2026-01-06T06:00:00.000Z",
      endUtc: "2026-01-06T12:00:00.000Z",
    });
    const result = checkAssignment(
      user,
      target,
      [priorShift],
      locationsById,
      fullAvailability(user.id),
      [user],
      [priorShift, target],
      { thresholds: { minRestHours: 3 } },
    );
    expect(result.violations.map((v) => v.code)).not.toContain("REST_PERIOD");
  });

  it("blocks when staff hasn't marked themselves available", () => {
    const user = makeUser();
    const shift = makeShift();
    const result = checkAssignment(user, shift, [], locationsById, [], [user], [shift]);
    expect(result.violations.map((v) => v.code)).toContain("OUTSIDE_AVAILABILITY");
  });

  it("hard-blocks a shift that would push someone over 12 hours in one local day", () => {
    const user = makeUser();
    const morning = makeShift({
      id: "shift-am",
      startUtc: "2026-01-05T14:00:00.000Z", // 6am Pacific
      endUtc: "2026-01-05T20:00:00.000Z", // 12pm Pacific, 6h
    });
    const bigTarget = makeShift({
      id: "shift-pm-big",
      startUtc: "2026-01-05T21:00:00.000Z", // 1pm Pacific
      endUtc: "2026-01-06T05:00:00.000Z", // 9pm Pacific, 8h more -> 14h same local day
    });
    const result = checkAssignment(
      user,
      bigTarget,
      [morning],
      locationsById,
      fullAvailability(user.id),
      [user],
      [morning, bigTarget],
    );
    expect(result.violations.map((v) => v.code)).toContain("DAILY_HOURS_BLOCK");
    expect(result.ok).toBe(false);
  });

  it("flags the 6th consecutive day as a warning, not a hard block", () => {
    const user = makeUser();
    const priorDays = Array.from({ length: 5 }, (_, i) => {
      const start = new Date("2026-01-05T18:00:00.000Z");
      start.setUTCDate(start.getUTCDate() + i);
      const end = new Date(start.getTime() + 4 * 3600 * 1000);
      return makeShift({ id: `shift-day-${i}`, startUtc: start.toISOString(), endUtc: end.toISOString() });
    });
    const sixthDay = new Date("2026-01-05T18:00:00.000Z");
    sixthDay.setUTCDate(sixthDay.getUTCDate() + 5);
    const target = makeShift({
      id: "shift-day-6",
      startUtc: sixthDay.toISOString(),
      endUtc: new Date(sixthDay.getTime() + 4 * 3600 * 1000).toISOString(),
    });
    const result = checkAssignment(
      user,
      target,
      priorDays,
      locationsById,
      fullAvailability(user.id),
      [user],
      [...priorDays, target],
    );
    const consecutiveViolation = result.violations.find((v) => v.code === "SEVENTH_CONSECUTIVE_DAY");
    expect(consecutiveViolation?.severity).toBe("warning");
  });

  it("hard-blocks the 7th consecutive day and requires a documented override", () => {
    const user = makeUser();
    const priorDays = Array.from({ length: 6 }, (_, i) => {
      const start = new Date("2026-01-05T18:00:00.000Z");
      start.setUTCDate(start.getUTCDate() + i);
      const end = new Date(start.getTime() + 4 * 3600 * 1000);
      return makeShift({ id: `shift-day-${i}`, startUtc: start.toISOString(), endUtc: end.toISOString() });
    });
    const seventhDay = new Date("2026-01-05T18:00:00.000Z");
    seventhDay.setUTCDate(seventhDay.getUTCDate() + 6);
    const target = makeShift({
      id: "shift-day-7",
      startUtc: seventhDay.toISOString(),
      endUtc: new Date(seventhDay.getTime() + 4 * 3600 * 1000).toISOString(),
    });
    const result = checkAssignment(
      user,
      target,
      priorDays,
      locationsById,
      fullAvailability(user.id),
      [user],
      [...priorDays, target],
    );
    const violation = result.violations.find((v) => v.code === "SEVENTH_CONSECUTIVE_DAY");
    expect(violation?.severity).toBe("block");
    expect(result.ok).toBe(false);
  });

  it("suggests qualified, available alternatives when the assignment is blocked", () => {
    const unqualified = makeUser({ id: "u-1", skills: ["host"] });
    const qualified = makeUser({ id: "u-2", name: "Qualified Staffer", skills: ["server"] });
    const shift = makeShift();
    const result = checkAssignment(
      unqualified,
      shift,
      [],
      locationsById,
      [...fullAvailability(unqualified.id), ...fullAvailability(qualified.id)],
      [unqualified, qualified],
      [shift],
    );
    expect(result.ok).toBe(false);
    expect(result.suggestions.some((s) => s.userId === "u-2")).toBe(true);
  });
});
