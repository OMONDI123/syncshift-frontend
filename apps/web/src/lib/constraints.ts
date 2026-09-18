import type {
  AssignmentCheck,
  AvailabilityWindow,
  ConstraintViolation,
  Location,
  Shift,
  User,
} from "@/types";
import { overlaps, restHoursBetween, shiftDurationHours } from "@/lib/time";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import { differenceInCalendarDays } from "date-fns";

/**
 * These used to be hardcoded constants. They're now admin-configurable (see
 * the Setup page / settingsStore) — checkAssignment() takes them as an
 * optional override and falls back to these defaults, so anything that
 * calls checkAssignment without opting in (tests, the landing-page teaser)
 * keeps behaving exactly as before.
 */
export interface ConstraintThresholds {
  minRestHours: number;
  dailyHardBlockHours: number;
  dailyWarningHours: number;
  weeklyWarningHours: number;
  weeklyFullTimeHours: number;
}

export const DEFAULT_CONSTRAINT_THRESHOLDS: ConstraintThresholds = {
  minRestHours: 10,
  dailyHardBlockHours: 12,
  dailyWarningHours: 8,
  weeklyWarningHours: 35,
  weeklyFullTimeHours: 40,
};

/**
 * Checks whether `user` can be assigned to `target`, given every other
 * shift already on their plate this week. This is the single source of
 * truth the UI calls before showing a confirm button — every violation
 * returned here must be a plain-language sentence, per the brief's
 * requirement to explain *which* rule broke and *why*.
 */
export function checkAssignment(
  user: User,
  target: Shift,
  usersOtherShifts: Shift[],
  locationsById: Record<string, Location>,
  availability: AvailabilityWindow[],
  allStaff: User[],
  allShifts: Shift[],
  options: { skipSuggestions?: boolean; thresholds?: Partial<ConstraintThresholds> } = {},
): AssignmentCheck {
  const violations: ConstraintViolation[] = [];
  const location = locationsById[target.locationId];
  const thresholds: ConstraintThresholds = { ...DEFAULT_CONSTRAINT_THRESHOLDS, ...options.thresholds };

  // 1. Skill match
  if (!user.skills.includes(target.skillRequired)) {
    violations.push({
      code: "SKILL_MISMATCH",
      severity: "block",
      message: `${user.name} isn't certified as a ${target.skillRequired.replace("_", " ")}, and this shift requires one.`,
    });
  }

  // 2. Location certification
  if (!user.certifiedLocationIds.includes(target.locationId)) {
    violations.push({
      code: "LOCATION_NOT_CERTIFIED",
      severity: "block",
      message: `${user.name} isn't certified to work at ${location?.name ?? "this location"}.`,
    });
  }

  // 3. Double booking / overlap (including across locations)
  const overlapping = usersOtherShifts.find((s) =>
    overlaps(s.startUtc, s.endUtc, target.startUtc, target.endUtc),
  );
  if (overlapping) {
    const otherLoc = locationsById[overlapping.locationId];
    violations.push({
      code: "DOUBLE_BOOKED",
      severity: "block",
      message: `${user.name} is already scheduled at ${otherLoc?.name ?? "another location"} during this time.`,
    });
  }

  // 4. 10-hour rest period
  const tooClose = usersOtherShifts.find((s) => {
    const restAfterOther = restHoursBetween(s.endUtc, target.startUtc);
    const restBeforeOther = restHoursBetween(target.endUtc, s.startUtc);
    return (
      (restAfterOther >= 0 && restAfterOther < thresholds.minRestHours) ||
      (restBeforeOther >= 0 && restBeforeOther < thresholds.minRestHours)
    );
  });
  if (tooClose && !overlapping) {
    violations.push({
      code: "REST_PERIOD",
      severity: "block",
      message: `${user.name} would have less than ${thresholds.minRestHours} hours off between this shift and another one.`,
    });
  }

  // 5. Availability window — checked in the STAFF MEMBER's own home
  // timezone, never the shift location's. A Seattle-based person certified
  // to also work a Miami shift didn't move to Eastern time; "9am-5pm" still
  // means their own morning, so we convert the shift's instant into their
  // home zone before comparing. This is the fix for the "Timezone Tangle"
  // case: a naive comparison against the location's local clock would
  // silently relabel someone's stated hours by however many zones apart
  // the two places are.
  if (!isWithinAvailability(user, target, availability)) {
    violations.push({
      code: "OUTSIDE_AVAILABILITY",
      severity: "block",
      message: `${user.name} hasn't marked themselves available during this time.`,
    });
  }

  // 6. Daily hours
  const dailyTotal =
    shiftDurationHours(target) +
    hoursOnSameLocalDay(target, usersOtherShifts, location);
  if (dailyTotal > thresholds.dailyHardBlockHours) {
    violations.push({
      code: "DAILY_HOURS_BLOCK",
      severity: "block",
      message: `This would put ${user.name} at ${dailyTotal.toFixed(1)} hours in one day — over the ${thresholds.dailyHardBlockHours}-hour limit.`,
    });
  } else if (dailyTotal > thresholds.dailyWarningHours) {
    violations.push({
      code: "DAILY_HOURS_BLOCK",
      severity: "warning",
      message: `This puts ${user.name} at ${dailyTotal.toFixed(1)} hours in one day.`,
    });
  }

  // 7. Consecutive days worked
  const consecutive = consecutiveDaysIncluding(target, usersOtherShifts, location);
  if (consecutive >= 7) {
    violations.push({
      code: "SEVENTH_CONSECUTIVE_DAY",
      severity: "block",
      message: `This would be ${user.name}'s 7th consecutive day worked. Requires a manager override with a documented reason.`,
    });
  } else if (consecutive === 6) {
    violations.push({
      code: "SEVENTH_CONSECUTIVE_DAY",
      severity: "warning",
      message: `This would be ${user.name}'s 6th consecutive day worked.`,
    });
  }

  // 8. Weekly hours warning (not a block — surfaced separately in the OT dashboard)
  const weeklyTotal =
    shiftDurationHours(target) +
    usersOtherShifts.reduce((sum, s) => sum + shiftDurationHours(s), 0);
  if (weeklyTotal > thresholds.weeklyFullTimeHours) {
    violations.push({
      code: "DAILY_HOURS_BLOCK",
      severity: "warning",
      message: `${user.name} would be at ${weeklyTotal.toFixed(1)} hours this week — into overtime.`,
    });
  } else if (weeklyTotal >= thresholds.weeklyWarningHours) {
    violations.push({
      code: "DAILY_HOURS_BLOCK",
      severity: "warning",
      message: `${user.name} would be at ${weeklyTotal.toFixed(1)} hours this week — approaching the 40-hour threshold.`,
    });
  }

  // Only look for alternatives at the top level. suggestAlternatives()
  // below calls back into checkAssignment() for each candidate it's
  // considering — if that inner call were also allowed to go looking for
  // suggestions, and one of the candidates it finds is itself blocked,
  // the two functions would call each other forever (same target, same
  // staff pool, nothing ever converges). skipSuggestions breaks that
  // cycle: we only ever need one level of "who else could take this?".
  const suggestions =
    !options.skipSuggestions && violations.some((v) => v.severity === "block")
      ? suggestAlternatives(target, allStaff, allShifts, locationsById, availability, thresholds)
      : [];

  return {
    ok: !violations.some((v) => v.severity === "block"),
    violations,
    suggestions,
  };
}

function isWithinAvailability(
  user: User,
  shift: Shift,
  availability: AvailabilityWindow[],
): boolean {
  const tz = user.homeTimezone;
  const zonedStart = toZonedTime(new Date(shift.startUtc), tz);
  const dow = zonedStart.getDay();
  const startMin = zonedStart.getHours() * 60 + zonedStart.getMinutes();
  const zonedEnd = toZonedTime(new Date(shift.endUtc), tz);
  const endMin =
    zonedEnd.getHours() * 60 +
    zonedEnd.getMinutes() +
    (differenceInCalendarDays(zonedEnd, zonedStart) > 0 ? 24 * 60 : 0);

  const windows = availability.filter((w) => w.userId === user.id);
  // One-off exceptions are keyed by calendar date in the person's own
  // timezone too, for the same reason as above.
  const localDate = formatInTimeZone(new Date(shift.startUtc), tz, "yyyy-MM-dd");
  const exception = windows.find((w) => w.type === "exception" && w.date === localDate);
  if (exception) return exception.available;

  return windows.some(
    (w) =>
      w.type === "recurring" &&
      w.available &&
      w.dayOfWeek === dow &&
      w.startMinutes <= startMin &&
      w.endMinutes >= endMin,
  );
}

function hoursOnSameLocalDay(
  target: Shift,
  others: Shift[],
  location?: Location,
): number {
  if (!location) return 0;
  const targetDay = toZonedTime(new Date(target.startUtc), location.timezone);
  return others
    .filter((s) => {
      const day = toZonedTime(new Date(s.startUtc), location.timezone);
      return differenceInCalendarDays(day, targetDay) === 0;
    })
    .reduce((sum, s) => sum + shiftDurationHours(s), 0);
}

function consecutiveDaysIncluding(
  target: Shift,
  others: Shift[],
  location?: Location,
): number {
  if (!location) return 1;
  const tz = location.timezone;
  const days = new Set(
    [target, ...others].map((s) =>
      toZonedTime(new Date(s.startUtc), tz).toDateString(),
    ),
  );
  const sorted = Array.from(days)
    .map((d) => new Date(d))
    .sort((a, b) => a.getTime() - b.getTime());

  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (differenceInCalendarDays(sorted[i], sorted[i - 1]) === 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

function suggestAlternatives(
  target: Shift,
  allStaff: User[],
  allShifts: Shift[],
  locationsById: Record<string, Location>,
  availability: AvailabilityWindow[],
  thresholds: ConstraintThresholds,
): { userId: string; reason: string }[] {
  return allStaff
    .filter((u) => u.role === "STAFF")
    .filter((u) => u.skills.includes(target.skillRequired))
    .filter((u) => u.certifiedLocationIds.includes(target.locationId))
    .filter((u) => {
      const theirShifts = allShifts.filter(
        (s) => s.assignedUserIds.includes(u.id) && s.id !== target.id,
      );
      const check = checkAssignment(
        u,
        target,
        theirShifts,
        locationsById,
        availability,
        allStaff,
        allShifts,
        { skipSuggestions: true, thresholds },
      );
      return check.ok;
    })
    .slice(0, 3)
    .map((u) => ({
      userId: u.id,
      reason: `Has the required skill, is certified here, and is free at this time.`,
    }));
}
