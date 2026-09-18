// Shared list of IANA timezones offered anywhere the app asks for one —
// a person's home timezone, or a location's local timezone. Centralized so
// the two pickers (User setup, Location setup) never drift out of sync.
export const IANA_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
];
