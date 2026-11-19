// ChitDialog's streak ring and the milestone heading beside it. The ring's default rule is a copy of
// `streakRingProgress` in @client (openchat-client/src/utils/chit.ts), which the library can't import: change both
// together.

/** How full the ring is, 0 to 1, for a streak and the milestones (sorted, shortest first; empty means none): the way
 *  from the last milestone reached (or 0) to the next. Full on the day a milestone is reached; once the next claim
 *  opens (`claimed` false) it starts on the next segment, empty, so a claim always moves the ring forward. Full from
 *  the last milestone on. */
export function streakRingProgress(streak: number, claimed: boolean, tiers: readonly number[]): number {
  const last = tiers[tiers.length - 1];
  if (streak <= 0 || last === undefined) return 0;
  if (streak >= last) return 1;
  if (tiers.includes(streak)) return claimed ? 1 : 0;
  const next = tiers.find((t) => t > streak) ?? last;
  const prev = tiers.filter((t) => t < streak).pop() ?? 0;
  return (streak - prev) / (next - prev);
}

/** The ring's fill: the host's `progress` (clamped to 0–1) when it's a finite number, else the default rule (a
 *  NaN would make the ring's gradient invalid and drop the whole ring). */
export function ringFill(progress: number | undefined, fallback: () => number): number {
  return progress != null && Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : fallback();
}

/** The milestone the streak reached today, while the ring shows it full (claimed, short of the last one, which has
 *  its own heading); undefined otherwise, when the heading counts the days to the next. */
export function milestoneReachedToday(streak: number, claimed: boolean, tiers: readonly number[]): number | undefined {
  const last = tiers[tiers.length - 1];
  return claimed && streak !== last && tiers.includes(streak) ? streak : undefined;
}
