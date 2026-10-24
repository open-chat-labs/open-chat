import type { ExternalAchievement, OpenChat } from "@client";

/** Something loaded, and when (ms): whatever depends on the time it was loaded goes by that. */
export type Loaded<T> = { value: T; at: number };

// a load shared by whatever asks within this long of it (the CHIT dialog, then the ways to earn
// it opens), so they don't ask the backend again back to back
const SHARED_FOR_MS = 60_000;

let last: { at: number; load: Promise<Loaded<ExternalAchievement[]>> } | undefined;

/** The partners' achievements, and when they were loaded. */
export function loadExternalAchievements(
    client: Pick<OpenChat, "getExternalAchievements">,
): Promise<Loaded<ExternalAchievement[]>> {
    const now = Date.now();
    if (last === undefined || now - last.at > SHARED_FOR_MS) {
        last = {
            at: now,
            load: client.getExternalAchievements().then((value) => ({ value, at: Date.now() })),
        };
    }
    return last.load;
}
