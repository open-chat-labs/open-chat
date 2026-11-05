import { resolve } from "@src/utils/routeTable.testing";
import { locationFor, type NativeLocation } from "../router/locations";
import { backAction } from "./back";
import { TabStacks } from "./tabStacks.svelte";

function at(url: string): NativeLocation {
    return locationFor(resolve(url), url, { signedOut: false, community: undefined });
}

// What system back does on `url`, its stack as the URL has it, going back where the header's Back
// goes (TabStacks.backUrl)
function back(url: string, overlayOpen = false, chatsUrl = "/chats") {
    const location = at(url);
    const stacks = new TabStacks();
    if (location.area === "tabs") stacks.arrive(location);
    return backAction({ overlayOpen, location, backUrl: stacks.backUrl(), chatsUrl });
}

describe("Android's system back", () => {
    test("closes an open sheet or menu first", () => {
        expect(back("/chats/group/g1", true)).toEqual({ kind: "close_overlay" });
        expect(back("/chats", true)).toEqual({ kind: "close_overlay" });
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

    test("leaves the app from outside the tabs, signed out", () => {
        expect(back("/home")).toEqual({ kind: "leave" });
    });
});
