import type { Component } from "svelte";
import { LazyModule } from "../../lazyModule.svelte";
import type { Regions } from "../../router/regions";
import type { RightColumnState } from "../../shell/rightColumn.svelte";

// Which screen shows in each region (router/regions.ts), by the region's kind. A screen is loaded
// the first time it shows, so each is its own chunk.
//
// Every kind has an entry, undefined until its screen is built (a placeholder shows meanwhile),
// and the entries are kept apart by blank lines: PRs adding different screens then change
// different lines, and don't conflict here (or in AppScreen, which doesn't change).

type AppRegions = Extract<Regions, { area: "app" }>;
export type LeftRegion = NonNullable<AppRegions["left"]>;
export type MiddleRegion = AppRegions["middle"];

/** What the app gives every screen besides its region. */
export type ScreenContext = {
    /** The right column's open state, for a screen's own toggle (a conversation header's). */
    rightColumn: RightColumnState;
    /** Whether the shell shows one column at a time. */
    narrow: boolean;
    /** Where a narrow screen's Back goes from the middle: the list it came from. */
    back?: string;
};

export type ScreenProps<R> = { region: R; context: ScreenContext };

type Loader<R> = () => Promise<{ default: Component<ScreenProps<R>> }>;

export type Screens<R extends { kind: string }> = {
    [K in R["kind"]]: Loader<Extract<R, { kind: K }>> | undefined;
};

export const leftScreens: Screens<LeftRegion> = {
    // the chat list: DMs and groups, favourites, a community's channels (phase 3a)
    chats: () => import("../chats/ChatsScreen.svelte"),

    // the threads followed (phase 3)
    threads: undefined,

    // notifications (phase 3d, ROUTES.md decision 7)
    activity: () => import("../activity/ActivityScreen.svelte"),

    // the wallet's tokens
    wallet: undefined,
};

export const middleScreens: Screens<MiddleRegion> = {
    // nothing selected
    empty: undefined,

    // the selected conversation (phase 3b)
    conversation: () => import("../conversation/ConversationScreen.svelte"),

    // explore communities
    explore: undefined,

    // the wallet's page
    wallet: undefined,

    // the platform operator console
    admin: undefined,
};

type AnyScreen = { default: Component<never> };

// one loader per screen, kept for the session: a screen loaded once shows at once when its region
// comes back (a remount), and a failed load is retried for that screen alone
const loaders = new WeakMap<() => Promise<AnyScreen>, LazyModule<AnyScreen>>();

/** The loader for a screen, shared by every region that shows it. */
export function screenLoader<M extends AnyScreen>(load: () => Promise<M>): LazyModule<M> {
    let loader = loaders.get(load);
    if (loader === undefined) {
        loader = new LazyModule<AnyScreen>(load);
        loaders.set(load, loader);
    }
    return loader as unknown as LazyModule<M>;
}

/**
 * A placeholder's account of a region, for development: its values on one line ("userId: abc ·
 * messageIndex: 12"), nested ones included. A nested object's kind is told under its own key
 * ("scope: community"), unless it only repeats the kind around it; the region's own is the title.
 */
export function regionSummary(region: { kind: string }): string {
    const parts: string[] = [];
    const walk = (value: unknown, key?: string, outerKind?: string) => {
        if (value === undefined || value === null) return;
        if (typeof value === "object") {
            const kind = "kind" in value ? String(value.kind) : undefined;
            if (key !== undefined && kind !== undefined && kind !== outerKind) {
                parts.push(`${key}: ${kind}`);
            }
            for (const [k, v] of Object.entries(value)) {
                if (k !== "kind") walk(v, k, kind);
            }
        } else if (key !== undefined) {
            parts.push(`${key}: ${String(value)}`);
        }
    };
    walk(region);
    return parts.join(" · ");
}
