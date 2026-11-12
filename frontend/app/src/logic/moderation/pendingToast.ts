import type { ResourceKey } from "@client";

// A platform moderator's action with no dialog of its own (unfreezing a group or a community,
// un-suspending a user, from a menu or a toast's Undo): the view shows `pending` in a toast with a
// loader while it runs, then what `run` comes to in the same toast.

/** How the action went, always in words: what the pending toast turns into. */
export type SettledOutcome =
    | { kind: "success"; message: ResourceKey }
    | { kind: "failed"; message: ResourceKey };

export type PendingToastAction = {
    /** What the toast says while the action is on its way ("Unfreezing Book Club…"). */
    pending: ResourceKey;
    /** Does it, and says how it went ("Book Club unfrozen", "Couldn't unfreeze Book Club"). */
    run: () => Promise<SettledOutcome>;
};
