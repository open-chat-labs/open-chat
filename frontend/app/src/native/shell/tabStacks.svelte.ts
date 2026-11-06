import type { LocalScreen, NativeTabId, StackStep, TabsLocation } from "../router/locations";

// The five tabs' push stacks (native design notes §1 Structure 2): each tab keeps its own, so a tab
// comes back as it was left. The URL names the screen showing (router/locations.ts); a stack is
// that screen and the ones under it, which Back goes through. A screen with no URL (New chat, a
// builder) is pushed over it locally (`push`), showing at the URL under it, and taken off by Back
// (`popLocal`) or by the URL moving on: going to another screen from it replaces it, as picking
// someone in New chat opens the chat in its place.

/**
 * How a tab's stack changed, for the push motion: `push` adds screens over the old top, `pop`
 * takes screens off it, `replace` swaps the top for another (the screens under it stay), `same`
 * changes nothing that shows (a URL's detail), and `switch` is another tab.
 */
export type StackChange = "push" | "pop" | "replace" | "same" | "switch";

/**
 * A tab's stack after it arrives at `next` (a URL's stack: its screen over the screens it sits on).
 * The stack keeps what it had up to the deepest screen the two share, and takes the rest from
 * `next`: going deeper pushes onto what's there, going to a screen already in the stack pops back
 * to it, and going sideways (another conversation, another community) replaces what's above the
 * screen in common. Screens are matched by key, and a shared screen takes `next`'s URL. Another
 * root (another community, Favourites for the list) is another stack: it replaces the old one.
 */
export function mergeStack(
    current: StackStep[] | undefined,
    next: StackStep[],
): { steps: StackStep[]; change: StackChange } {
    if (current === undefined || current.length === 0 || current[0].key !== next[0]?.key) {
        return { steps: next, change: "replace" };
    }
    for (let j = next.length - 1; j >= 0; j--) {
        const i = current.findIndex((s) => s.key === next[j].key);
        if (i >= 0) {
            const steps = [...current.slice(0, i), ...next.slice(j)];
            return { steps, change: changeOf(current, steps) };
        }
    }
    return { steps: next, change: "replace" };
}

function changeOf(before: StackStep[], after: StackStep[]): StackChange {
    const shared = commonKeys(before, after);
    if (shared === before.length && shared === after.length) return "same";
    if (shared === before.length) return "push";
    if (shared === after.length) return "pop";
    return "replace";
}

// How many screens from the root the two have in common
function commonKeys(a: StackStep[], b: StackStep[]): number {
    let n = 0;
    while (n < a.length && n < b.length && a[n].key === b[n].key) n++;
    return n;
}

function topUrl(steps: StackStep[]): string | undefined {
    return steps[steps.length - 1]?.url;
}

function sameSteps(a: StackStep[], b: StackStep[]): boolean {
    return a.length === b.length && a.every((s, i) => s.key === b[i].key && s.url === b[i].url);
}

export class TabStacks {
    // replaced whole on every change, never mutated
    #stacks = $state.raw<Partial<Record<NativeTabId, StackStep[]>>>({});
    #tab = $state<NativeTabId>("chats");
    #change = $state<StackChange>("switch");

    /** The tab showing. */
    get tab(): NativeTabId {
        return this.#tab;
    }

    /** How the stack showing last changed. */
    get change(): StackChange {
        return this.#change;
    }

    /** The stack showing, from the tab's root to the screen on top. */
    get steps(): StackStep[] {
        return this.#stacks[this.#tab] ?? [];
    }

    /** A tab's stack, or none for a tab not opened yet. */
    stackOf(tab: NativeTabId): StackStep[] | undefined {
        return this.#stacks[tab];
    }

    /**
     * Takes in the place the URL names: that tab shows, and its stack goes there. The URL showing
     * keeps the stack it was entered with: the same URL again (its place worked out afresh after the
     * user's communities changed, say) changes nothing, so nothing moves under the user.
     */
    arrive(location: TabsLocation): void {
        const current = this.#stacks[location.tab];
        const switched = location.tab !== this.#tab;
        if (current !== undefined && topUrl(current) === topUrl(location.steps)) {
            // back to a tab left as it was, local screens and all
            if (switched) {
                this.#change = "switch";
                this.#tab = location.tab;
            }
            return;
        }
        const { steps, change } = mergeStack(current, location.steps);
        if (!switched && current !== undefined && sameSteps(current, steps)) return;
        this.#stacks = { ...this.#stacks, [location.tab]: steps };
        this.#change = switched ? "switch" : change;
        this.#tab = location.tab;
    }

    /**
     * Pushes a screen with no URL over the one showing. It shows at that one's URL; one already in
     * the stack is popped back to instead.
     */
    push(screen: LocalScreen): void {
        const steps = this.steps;
        const top = steps[steps.length - 1];
        if (top === undefined) return;
        const key = `local:${screen.kind}`;
        const at = steps.findIndex((s) => s.key === key);
        if (at >= 0) {
            this.#set(steps.slice(0, at + 1), "pop");
            return;
        }
        this.#set([...steps, { key, screen, url: top.url, local: true }], "push");
    }

    /** Back from a screen with no URL: takes it off. Whether the top was one. */
    popLocal(): boolean {
        const steps = this.steps;
        if (steps.length < 2 || !steps[steps.length - 1].local) return false;
        this.#set(steps.slice(0, -1), "pop");
        return true;
    }

    /** Takes every screen with no URL off the top (the tab tapped again). Whether there were any. */
    popLocals(): boolean {
        let popped = false;
        while (this.popLocal()) popped = true;
        return popped;
    }

    /** Whether the screen showing has no URL of its own. */
    get localTop(): boolean {
        const steps = this.steps;
        return steps[steps.length - 1]?.local === true;
    }

    #set(steps: StackStep[], change: StackChange): void {
        this.#stacks = { ...this.#stacks, [this.#tab]: steps };
        this.#change = change;
    }

    /** Where Back goes: the screen under the top, or none at a tab's root. */
    backUrl(): string | undefined {
        const steps = this.steps;
        return steps.length > 1 ? steps[steps.length - 2].url : undefined;
    }

    /** Where a tab opens: the screen it was left on, or none for a tab not opened yet. */
    topUrl(tab: NativeTabId): string | undefined {
        const steps = this.#stacks[tab];
        return steps?.[steps.length - 1]?.url;
    }

    /** A tab's root, once it's been opened. */
    root(tab: NativeTabId): StackStep | undefined {
        return this.#stacks[tab]?.[0];
    }
}
