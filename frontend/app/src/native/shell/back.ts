import type { NativeLocation, NativeTabId } from "../router/locations";

// What Android's system back does in the native tree (native design notes §2): it closes an open
// sheet or menu first, then pops the screen on top, then takes another tab back to Chats, the first
// tab (as the mobile app's back does: navigation.ts, "chats is the root tab"), and from Chats' root
// leaves the app. Signed out, it goes back through the signed-out start (Pick a username or
// Welcome back to Welcome, Link to Welcome back), and from Welcome leaves the app. iOS has no
// system back: there it's the header's chevron (and the edge swipe).

export type BackAction =
    | { kind: "close_overlay" }
    | { kind: "navigate"; url: string }
    /** Back a screen in the signed-out start (StartStack.back). */
    | { kind: "start_back" }
    | { kind: "leave" };

export type BackState = {
    /** A sheet or menu is open (Overlays). */
    overlayOpen: boolean;
    location: NativeLocation;
    /** The screen under the top, as the header's Back has it (TabStacks.backUrl); none at a root. */
    backUrl: string | undefined;
    /** Where the Chats tab is: the screen it was left on, else its root. */
    chatsUrl: string;
    /** The signed-out start has a screen under the one showing (StartStack.canGoBack). */
    startBack: boolean;
};

export function backAction({
    overlayOpen,
    location,
    backUrl,
    chatsUrl,
    startBack,
}: BackState): BackAction {
    if (overlayOpen) return { kind: "close_overlay" };
    switch (location.area) {
        case "signed_out":
            return startBack ? { kind: "start_back" } : { kind: "leave" };
        case "marketing":
            // a marketing page opens in the browser and the app steps back at once (Shell); should
            // Back come first, "/" is the signed-out start, or the chats
            return { kind: "navigate", url: "/" };
        case "not_found":
            return { kind: "navigate", url: chatsUrl };
        case "tabs":
            return tabsBack(location.tab, backUrl, chatsUrl);
    }
}

function tabsBack(tab: NativeTabId, backUrl: string | undefined, chatsUrl: string): BackAction {
    if (backUrl !== undefined) return { kind: "navigate", url: backUrl };
    if (tab !== "chats") return { kind: "navigate", url: chatsUrl };
    return { kind: "leave" };
}
