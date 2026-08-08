/**
 * When a campaign is allowed to dial.
 *
 * This is a compliance boundary, not a preference. TRAI's Telecom Commercial
 * Communications Customer Preference Regulations restrict promotional voice
 * calls to 09:00–21:00 local time; calling outside it is a violation that lands
 * on the enterprise, not on the platform. So the window is enforced in the
 * dispatcher rather than left to whoever configures a campaign, and the default
 * is the legal maximum rather than something wider.
 *
 * Everything here is pure and takes an explicit `at`, so the tests do not have
 * to mock the clock and the behaviour at 20:59 and 21:00 is actually testable.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * India is UTC+5:30 with no daylight saving — it has not observed DST since
 * 1945 — so a fixed offset is exact here, not an approximation. That matters
 * because the alternative, formatting through Intl on every check, is both
 * slower and harder to reason about when the server runs in UTC (Vercel) and
 * the developer's laptop does not.
 */
const IST_OFFSET_MS = 5.5 * HOUR;

/** TRAI's permitted window for promotional voice calls. */
export const DEFAULT_WINDOW = { startHour: 9, endHour: 21 } as const;

/** The hour of day in IST, 0–23. */
export function istHour(at: Date): number {
  return Math.floor(((at.getTime() + IST_OFFSET_MS) % DAY) / HOUR);
}

/** Formats an instant as IST wall-clock time, for logs a human has to read. */
export function istLabel(at: Date): string {
  const shifted = new Date(at.getTime() + IST_OFFSET_MS);
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} IST`;
}

export interface CallWindow {
  callWindowStartHour: number;
  callWindowEndHour: number;
}

/** Inclusive of the start hour, exclusive of the end — 21:00 is already too late. */
export function isWithinWindow(at: Date, w: CallWindow): boolean {
  const h = istHour(at);
  return h >= w.callWindowStartHour && h < w.callWindowEndHour;
}

/**
 * The next instant at which dialling is permitted — `at` itself if the window
 * is already open.
 *
 * Retries are scheduled through this, so a contact that fails at 20:58 does not
 * get its five-minute retry at 21:03 and quietly break the rule the campaign
 * was configured to respect.
 */
export function nextWindowOpen(at: Date, w: CallWindow): Date {
  const shifted = at.getTime() + IST_OFFSET_MS;
  const dayStart = Math.floor(shifted / DAY) * DAY;
  let open = dayStart + w.callWindowStartHour * HOUR;

  if (shifted >= open) {
    if (shifted < dayStart + w.callWindowEndHour * HOUR) return at; // already inside
    open += DAY; // past today's close — tomorrow morning
  }
  return new Date(open - IST_OFFSET_MS);
}

/**
 * Retry backoff, clamped back into the calling window.
 *
 * The spacing is deliberately wide. A missed call retried four minutes later
 * reads as a robot; the point of a retry is to catch someone who was genuinely
 * unavailable, which usually means a different part of the day.
 */
const BACKOFF_MINUTES = [45, 240, 1_440];

export function nextAttemptAt(attempts: number, w: CallWindow, now = new Date()): Date {
  const minutes = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)];
  return nextWindowOpen(new Date(now.getTime() + minutes * 60_000), w);
}
