import type { UpdateGroupState } from "@src/logic/groupOrCommunity/group.svelte";

// Create group's draft, held while its screen is open, for the pages it pushes over itself (its
// gates, rules and permissions: `new_group_settings`), which edit the same group. A local screen
// is pushed as data, so the draft can't go with it.

let held: UpdateGroupState | undefined;

/** Holds `draft` for the pages Create group pushes; returns what lets it go (as the screen goes). */
export function holdNewGroup(draft: UpdateGroupState): () => void {
    held = draft;
    return () => {
        if (held === draft) held = undefined;
    };
}

/** The draft Create group holds, if its screen is open. */
export function newGroupDraft(): UpdateGroupState | undefined {
    return held;
}
