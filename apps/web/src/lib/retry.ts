/** Wraps a fetch call so a single transient failure (a burst-load blip, a
 * momentary 403/5xx, a dropped connection) doesn't silently and permanently
 * present as "there's nothing here."
 *
 * Root cause this exists for: several bootstrap loaders fire many requests
 * in one parallel burst at login (schedule shifts per location, swap lists,
 * presence per location). Under load, a request in that burst can fail —
 * and every one of those call sites used to do `.catch(() => [])`, which
 * makes a real clock-in or a real assignment vanish from the UI with zero
 * indication anything went wrong. One retry after a short backoff absorbs
 * the transient case; a fallback value still applies if it genuinely keeps
 * failing, but only after a genuine second attempt rather than none.
 */
export async function withRetry<T>(fn: () => Promise<T>, fallback: T, retries = 1, delayMs = 500): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) {
      // eslint-disable-next-line no-console
      console.warn("Bootstrap fetch failed after retries, using fallback:", err);
      return fallback;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return withRetry(fn, fallback, retries - 1, delayMs * 2);
  }
}
