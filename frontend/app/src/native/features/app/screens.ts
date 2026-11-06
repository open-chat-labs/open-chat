import type { Component } from "svelte";
import type { LocalScreen, NativeScreen } from "../../router/locations";
import type { Overlays } from "../../shell/overlays.svelte";

// Which screen shows for each kind of native screen (router/locations.ts), a tab's root or one
// pushed. A screen is loaded the first time it shows, so each is its own chunk.
//
// Every kind has an entry, undefined until its screen is built (a placeholder shows meanwhile), and
// the entries are kept apart by blank lines: issues adding different screens then change different
// lines, and don't conflict here (or in ScreenHost, which doesn't change).

/** What the shell gives every screen besides its own place. */
export type ScreenContext = {
    /** A pushed screen's Back (its header's back): none at a tab's root. */
    back: (() => void) | undefined;
    /** Where a screen registers an open sheet or menu, so Android's back closes it first. */
    overlays: Overlays;
    /** Pushes a screen that has no URL (New chat, a builder) over this one (TabStacks.push). */
    push: (screen: LocalScreen) => void;
    /**
     * Shows a toast (text, translated) in place of the one showing; with `undo`, it offers Undo,
     * which runs it (a destructive action, notes §1 Sheets, menus, toasts).
     */
    toast: (message: string, undo?: () => void) => void;
};

export type ScreenProps<S> = { screen: S; context: ScreenContext };

export type Loader<S> = () => Promise<{ default: Component<ScreenProps<S>> }>;

export type Screens = {
    [K in NativeScreen["kind"]]: Loader<Extract<NativeScreen, { kind: K }>> | undefined;
};

export const screens: Screens = {
    // the Chats tab: the list, search and New chat (N5a)
    chats: undefined,

    // the Communities tab: the switcher and a community's channels (N8a)
    communities: undefined,

    // the Wallet tab's root (N10a)
    wallet: undefined,

    // the Activity tab (N13)
    activity: undefined,

    // the You tab (N12)
    you: undefined,

    // a conversation (N5b)
    conversation: undefined,

    // a thread (N8a)
    thread: undefined,

    // the followed threads (N8a)
    threads: undefined,

    // Explore (N8b)
    explore: undefined,

    // a token's page (N10a)
    token: undefined,

    // Send, Receive and Swap (N10b)
    wallet_flow: undefined,

    // the saved recipients (N10b)
    recipients: undefined,

    // the platform operator console: none on native yet
    admin: undefined,

    // New chat, from the Chats tab's FAB (N5a)
    new_chat: undefined,

    // New group, from the Chats tab's menu and New chat (N7)
    new_group: undefined,

    // CHIT, from the Chats tab's header (N11)
    chit: undefined,
};

/** The loader for a screen's kind, or none until it's built. */
export function screenLoader(screen: NativeScreen): Loader<NativeScreen> | undefined {
    // the entry for a kind takes that kind's screen, which `screen` is
    return screens[screen.kind] as Loader<NativeScreen> | undefined;
}
