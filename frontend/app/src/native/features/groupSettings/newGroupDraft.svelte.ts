import type { UpdateGroupState } from "@src/logic/groupOrCommunity/group.svelte";

// Create group's draft, held while its screen is open, for the pages it pushes over itself (its
// gates, rules and permissions: `new_group_settings`), which edit the same group. A local screen
// is pushed as data, so the draft can't go with it.

export class NewGroupDraft {
    readonly editor: UpdateGroupState;
    #pagesOver = $state(0);

    constructor(editor: UpdateGroupState) {
        this.editor = editor;
    }

    /**
     * Whether a page is pushed over Create group. The screens under the top one stay mounted, and
     * the shell's overlays are one list, so Create group's own Back (a step back, the discard
     * question) only registers while nothing is over it: Android's back closes the page on top.
     */
    get covered(): boolean {
        return this.#pagesOver > 0;
    }

    /** A page opens over Create group on this draft; returns what closes it (as the page goes). */
    openPage(): () => void {
        this.#pagesOver += 1;
        let open = true;
        return () => {
            if (!open) return;
            open = false;
            this.#pagesOver -= 1;
        };
    }
}

let held: NewGroupDraft | undefined;

/** Holds `draft` for the pages Create group pushes; returns what lets it go (as the screen goes). */
export function holdNewGroup(draft: NewGroupDraft): () => void {
    held = draft;
    return () => {
        if (held === draft) held = undefined;
    };
}

/** The draft Create group holds, if its screen is open. */
export function newGroupDraft(): NewGroupDraft | undefined {
    return held;
}
