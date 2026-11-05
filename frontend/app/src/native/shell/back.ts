import type { NativeLocation, NativeTabId, StackStep } from "../router/locations";

// What Android's system back does in the native tree (native design notes §2): it closes an open
// sheet or menu first, then pops the screen on top, then takes another tab back to Chats, the first
// tab (as the mobile app's back does: navigation.ts, "chats is the root tab"), and from Chats' root
// leaves the app. iOS has no system back: there it's the header's chevron (and the edge swipe).

export type BackAction =
    | { kind: "close_overlay" }
    | { kind: "navigate"; url: string }
    | { kind: "leave" };

export type BackState = {
    /** A sheet or menu is open (Overlays). */
    overlayOpen: boolean;
    location: NativeLocation;
    /** The stack showing (TabStacks.steps). */
    steps: StackStep[];
    /** Where the Chats tab is: the screen it was left on, else its root. */
    chatsUrl: string;
};

export function backAction({ overlayOpen, location, steps, chatsUrl }: BackState): BackAction {
    if (overlayOpen) return { kind: "close_overlay" };
    switch (location.area) {
        case "marketing":
            // signed out, outside the app's tabs
            return { kind: "leave" };
        case "not_found":
            return { kind: "navigate", url: chatsUrl };
        case "tabs":
            return tabsBack(location.tab, steps, chatsUrl);
    }
}

function tabsBack(tab: NativeTabId, steps: StackStep[], chatsUrl: string): BackAction {
    if (steps.length > 1) return { kind: "navigate", url: steps[steps.length - 2].url };
    if (tab !== "chats") return { kind: "navigate", url: chatsUrl };
    return { kind: "leave" };
}
