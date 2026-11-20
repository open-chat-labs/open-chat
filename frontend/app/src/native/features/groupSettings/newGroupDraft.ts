import type { UpdateGroupState } from "@src/logic/groupOrCommunity/group.svelte";

// Create group's draft, held while its screen is open, for the pages it pushes over itself (its
// gates, rules and permissions: `new_group_settings`), which edit the same group. A local screen
// is pushed as data, so the draft can't go with it. Create group can be open twice (pushed again
// from New chat over the first): each holds its own, and the pages get the newest one's, which
// is the one they're pushed from; once it goes, the one under it is the newest again.

let held: UpdateGroupState[] = [];

/** Holds `draft` for the pages Create group pushes; returns what lets it go (as the screen goes). */
export function holdNewGroup(draft: UpdateGroupState): () => void {
    held = [...held, draft];
    return () => {
        held = held.filter((d) => d !== draft);
    };
}

/** The draft of the newest Create group open, if one is. */
export function newGroupDraft(): UpdateGroupState | undefined {
    return held[held.length - 1];
}
