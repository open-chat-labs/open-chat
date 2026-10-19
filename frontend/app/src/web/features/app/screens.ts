import type { Component } from "svelte";
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
    chats: undefined,

    // the threads followed (phase 3)
    threads: undefined,

    // notifications (phase 3d, ROUTES.md decision 7)
    activity: undefined,

    // the wallet's tokens
    wallet: undefined,
};

export const middleScreens: Screens<MiddleRegion> = {
    // nothing selected
    empty: undefined,

    // the selected conversation (phase 3b)
    conversation: undefined,

    // explore communities
    explore: undefined,

    // the wallet's page
    wallet: undefined,

    // the platform operator console
    admin: undefined,
};

/** A placeholder's account of a region: its parameters, for development. */
export function regionSummary(region: { kind: string }): string {
    const { kind: _kind, ...params } = region;
    if (Object.keys(params).length === 0) return "";
    return JSON.stringify(params, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
    );
}
