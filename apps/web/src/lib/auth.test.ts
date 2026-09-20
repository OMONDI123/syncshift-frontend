import { describe, expect, it } from "vitest";
import { canManageLocation, canExportAuditLog, routeAllowed } from "@/lib/auth";
import type { User } from "@/types";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u-1",
    name: "Test User",
    email: "test@coastaleats.com",
    role: "MANAGER",
    avatarColor: "#000",
    skills: [],
    certifiedLocationIds: [],
    managedLocationIds: ["loc-a"],
    homeTimezone: "America/Los_Angeles",
    notificationChannel: "IN_APP_ONLY",
    active: true,
    ...overrides,
  };
}

describe("permissions", () => {
  it("lets a manager manage only their assigned locations", () => {
    const manager = makeUser({ managedLocationIds: ["loc-a"] });
    expect(canManageLocation(manager, "loc-a")).toBe(true);
    expect(canManageLocation(manager, "loc-b")).toBe(false);
  });

  it("lets an admin manage every location", () => {
    const admin = makeUser({ role: "ADMIN", managedLocationIds: [] });
    expect(canManageLocation(admin, "loc-anything")).toBe(true);
  });

  it("denies staff from managing any location", () => {
    const staffMember = makeUser({ role: "STAFF", managedLocationIds: [] });
    expect(canManageLocation(staffMember, "loc-a")).toBe(false);
  });

  it("only allows admins to export the audit log", () => {
    expect(canExportAuditLog(makeUser({ role: "ADMIN" }))).toBe(true);
    expect(canExportAuditLog(makeUser({ role: "MANAGER" }))).toBe(false);
    expect(canExportAuditLog(null)).toBe(false);
  });

  it("checks route access against the allowed role list", () => {
    expect(routeAllowed(makeUser({ role: "STAFF" }), ["STAFF"])).toBe(true);
    expect(routeAllowed(makeUser({ role: "STAFF" }), ["MANAGER", "ADMIN"])).toBe(false);
    expect(routeAllowed(null, ["STAFF"])).toBe(false);
  });
});
