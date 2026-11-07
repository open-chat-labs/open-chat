import { resolve } from "@src/utils/routeTable.testing";
import { locationFor, type LocalScreen, type NativeLocation } from "../router/locations";
import { backAction } from "./back";
import { TabStacks } from "./tabStacks.svelte";

function at(url: string, signedOut = false): NativeLocation {
    return locationFor(resolve(url), url, { signedOut, community: undefined });
}

// What system back does on `url`, its stack as the URL has it, going back where the header's Back
// goes (TabStacks.backUrl)
function back(
    url: string,
    overlayOpen = false,
    chatsUrl = "/chats",
    newChat = false,
    local?: LocalScreen,
) {
    const location = at(url);
    const stacks = new TabStacks();
    if (location.area === "tabs") stacks.arrive(location);
    if (newChat) stacks.push({ kind: "new_chat" });
    if (local !== undefined) stacks.push(local);
    return backAction({
        overlayOpen,
        localTop: stacks.localTop,
        location,
        backUrl: stacks.backUrl(),
        chatsUrl,
        startBack: false,
    });
}

describe("Android's system back", () => {
    test("closes an open sheet or menu first", () => {
        expect(back("/chats/group/g1", true)).toEqual({ kind: "close_overlay" });
        expect(back("/chats", true)).toEqual({ kind: "close_overlay" });
    });

    test("takes a screen with no URL off, after an open sheet or menu", () => {
        expect(back("/chats", false, "/chats", true)).toEqual({ kind: "pop_local" });
        expect(back("/chats", true, "/chats", true)).toEqual({ kind: "close_overlay" });
    });

    // it went back to the Chats tab when the WebView's own back took the press (systemBack.ts)
    test("takes a settings page off the You tab, back to the You tab", () => {
        for (const page of ["chats", "appearance", "storage", "account"] as const) {
            expect(
                back("/profile_summary", false, "/chats", false, { kind: "settings", page }),
            ).toEqual({ kind: "pop_local" });
        }
        expect(back("/profile_summary", false, "/chats", false, { kind: "edit_profile" })).toEqual({
            kind: "pop_local",
        });
        expect(back("/profile_summary?diamond")).toEqual({
            kind: "navigate",
            url: "/profile_summary",
        });
        expect(back("/profile_summary?profile=chit")).toEqual({
            kind: "navigate",
            url: "/profile_summary",
        });
    });

    // an open search in a conversation registers as an overlay (useOverlay) while it's open: back
    // closes it (and with it the keyboard) and stays in the chat. The keyboard itself takes the first
    // back while it's up (Android's), which never reaches the app
    test("closes the search in a conversation rather than going back to the list", () => {
        expect(back("/chats/user/u1", true)).toEqual({ kind: "close_overlay" });
        expect(back("/community/c1/channel/9", true)).toEqual({ kind: "close_overlay" });
        expect(back("/chats/user/u1")).toEqual({ kind: "navigate", url: "/chats" });
    });

    test("takes a chat's details off, back to the conversation", () => {
        const details: LocalScreen = {
            kind: "chat_details",
            chatId: { kind: "direct_chat", userId: "u1" },
        };
        expect(back("/chats/user/u1", false, "/chats", false, details)).toEqual({
            kind: "pop_local",
        });
    });

    test("pops the screen on top", () => {
        expect(back("/chats/group/g1")).toEqual({ kind: "navigate", url: "/chats" });
        expect(back("/chats/group/g1/5?open=true")).toEqual({
            kind: "navigate",
            url: "/chats/group/g1",
        });
        expect(back("/wallet/send?token=ledger1")).toEqual({
            kind: "navigate",
            url: "/wallet/ledger1",
        });
    });

    test("takes another tab's root back to Chats, where it was left", () => {
        expect(back("/wallet", false, "/chats/user/u1")).toEqual({
            kind: "navigate",
            url: "/chats/user/u1",
        });
        expect(back("/notifications")).toEqual({ kind: "navigate", url: "/chats" });
    });

    test("leaves the app from Chats' root", () => {
        expect(back("/chats")).toEqual({ kind: "leave" });
        expect(back("/favourite")).toEqual({ kind: "leave" });
    });

    test("goes to Chats from a page that isn't found", () => {
        expect(back("/a/b/c/d/e")).toEqual({ kind: "navigate", url: "/chats" });
    });

    test("goes from a marketing page to the start, or the chats", () => {
        expect(back("/home")).toEqual({ kind: "navigate", url: "/" });
    });

    test("signed out, goes back through the start, then leaves the app from Welcome", () => {
        const signedOut = (startBack: boolean, overlayOpen = false) =>
            backAction({
                overlayOpen,
                localTop: false,
                location: at("/", true),
                backUrl: undefined,
                chatsUrl: "/chats",
                startBack,
            });
        expect(signedOut(true, true)).toEqual({ kind: "close_overlay" });
        expect(signedOut(true)).toEqual({ kind: "start_back" });
        expect(signedOut(false)).toEqual({ kind: "leave" });
    });
});
