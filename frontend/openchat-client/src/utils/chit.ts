import type { ChitState } from "@shared";

/** The user's streak as of `now` (ms): none once it has ended (`streakEnds`), until they claim again. */
export function currentStreak(
    state: Pick<ChitState, "streak" | "streakEnds">,
    now: number,
): number {
    return state.streakEnds < now ? 0 : state.streak;
}
