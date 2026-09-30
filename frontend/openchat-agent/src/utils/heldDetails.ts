import { offline } from "@shared";

export type DetailsUpdatesOutcome =
    | { kind: "success" }
    | { kind: "success_no_updates"; timestamp: bigint }
    | { kind: "failure" };

/**
 * For a caller which already holds the details of a chat or community as they were at `held`.
 * Returns the timestamp those details are now known to be good up to, or `undefined` if they have
 * changed and so must be loaded in full.
 *
 * The details can run to tens of thousands of members and an active chat asks after every message,
 * so this neither reads nor writes the cached details, and nothing is handed back to be copied to
 * the main thread and rebuilt into its stores.
 */
export async function confirmHeldDetails(
    held: bigint,
    lastUpdated: bigint,
    updatesSince: (since: bigint) => Promise<DetailsUpdatesOutcome>,
): Promise<bigint | undefined> {
    if (held >= lastUpdated || offline()) {
        return held;
    }

    const outcome = await updatesSince(held);
    switch (outcome.kind) {
        case "success_no_updates":
            // The canister's timestamp can be behind `held` if the query hit a lagging replica
            return outcome.timestamp > held ? outcome.timestamp : held;
        case "failure":
            return held;
        case "success":
            return undefined;
    }
}
