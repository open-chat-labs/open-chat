// Duration ids ('12 hours', '1 week' …): the stable English values TimedToggle reports (shown through the i18n's
// durationText), and their lengths. One home for both, so the web's pickers and the app's native screens offer the
// same lengths and read them the same way.

/** The lengths a chat's disappearing messages can be set to: TimedToggle's own list when it's given no `options`. */
export const DISAPPEARING_DURATIONS: readonly string[] = ['1 hour', '8 hours', '12 hours', '1 day', '1 week', '30 days'];

// months count as 30 days, years as 365
const UNIT_MS: Record<string, number> = { minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 };

/** A duration id in milliseconds; 0 for one that isn't a duration ('Always'). */
export function durationMs(id: string): number {
  const m = id.match(/^(\d+) (minute|hour|day|week|month|year)s?$/);
  return m ? Number(m[1]) * UNIT_MS[m[2]] : 0;
}
