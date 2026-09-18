import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { differenceInMinutes, isSameDay } from "date-fns";
import type { Location, Shift } from "@/types";

/**
 * All shift instants are stored as UTC ISO strings. We only ever convert to
 * a location's IANA timezone at the point of display, and we always pass an
 * explicit timezone — never rely on the browser's local zone — so a Pacific
 * manager and an Eastern manager see the same shift labelled correctly for
 * where it happens, not where they're sitting.
 */

export function formatShiftTime(iso: string, timezone: string): string {
  return formatInTimeZone(new Date(iso), timezone, "h:mm a");
}

export function formatShiftDay(iso: string, timezone: string): string {
  return formatInTimeZone(new Date(iso), timezone, "EEE, MMM d");
}

export function formatShiftRange(shift: Shift, location: Location): string {
  const start = formatShiftTime(shift.startUtc, location.timezone);
  const end = formatShiftTime(shift.endUtc, location.timezone);
  const overnight = isOvernightShift(shift, location.timezone);
  return `${start} – ${end}${overnight ? " (+1 day)" : ""}`;
}

/** A shift is "overnight" if its local start and end land on different days. */
export function isOvernightShift(shift: Shift, timezone: string): boolean {
  const start = toZonedTime(new Date(shift.startUtc), timezone);
  const end = toZonedTime(new Date(shift.endUtc), timezone);
  return !isSameDay(start, end);
}

export function shiftDurationHours(shift: Shift): number {
  return (
    differenceInMinutes(new Date(shift.endUtc), new Date(shift.startUtc)) / 60
  );
}

/** Hours of rest between the end of shift A and the start of shift B. */
export function restHoursBetween(aEndUtc: string, bStartUtc: string): number {
  return differenceInMinutes(new Date(bStartUtc), new Date(aEndUtc)) / 60;
}

export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}
