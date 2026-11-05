import type { CommunityIdentifier } from "@client";
import { resolve } from "@src/utils/routeTable.testing";
import {
    hidesTabBar,
    locationFor,
    NATIVE_TABS,
    tabRootUrl,
    type LocationContext,
    type NativeLocation,
} from "./locations";

const community = (communityId: string): CommunityIdentifier => ({
    kind: "community",
    communityId,
});

const signedIn: LocationContext = { signedOut: false, community: community("c1") };

// Where a URL is, resolved by the route table as the router does
function at(url: string, context: LocationContext = signedIn): NativeLocation {
    return locationFor(resolve(url), url, context);
}

// A URL's tab and its stack's screens, as "kind@url", root first
function stack(url: string, context: LocationContext = signedIn): string {
    const location = at(url, context);
    if (location.area !== "tabs") return location.area;
    return `${location.tab}: ${location.steps.map((s) => `${s.screen.kind}@${s.url}`).join(" > ")}`;
}

describe("where a URL is in the native tree", () => {
    test("a chat is the Chats tab with the list, then the conversation", () => {
        expect(stack("/chats/user/u1")).toBe("chats: chats@/chats > conversation@/chats/user/u1");
        expect(stack("/chats/group/g1")).toBe("chats: chats@/chats > conversation@/chats/group/g1");
        // the short and legacy paths too
        expect(stack("/user/u1")).toBe("chats: chats@/chats > conversation@/user/u1");
        expect(stack("/group/g1")).toBe("chats: chats@/chats > conversation@/group/g1");
        expect(stack("/g1")).toBe("chats: chats@/chats > conversation@/g1");
    });

    test("the URL itself is the top's, message index and query kept", () => {
        expect(stack("/chats/group/g1/57")).toBe(
            "chats: chats@/chats > conversation@/chats/group/g1/57",
        );
    });

    test("a thread is pushed over its conversation", () => {
        expect(stack("/chats/group/g1/57?open=true")).toBe(
            "chats: chats@/chats > conversation@/chats/group/g1 > thread@/chats/group/g1/57?open=true",
        );
        expect(stack("/chats/group/g1/57/3")).toBe(
            "chats: chats@/chats > conversation@/chats/group/g1 > thread@/chats/group/g1/57/3",
        );
        expect(stack("/community/c2/channel/9/12?open=true")).toBe(
            "communities: communities@/community/c2 > conversation@/community/c2/channel/9 > thread@/community/c2/channel/9/12?open=true",
        );
    });

    test("favourites are the Chats tab, a favourite channel included", () => {
        expect(stack("/favourite")).toBe("chats: chats@/favourite");
        expect(stack("/favourite/user/u1")).toBe(
            "chats: chats@/favourite > conversation@/favourite/user/u1",
        );
        expect(stack("/favourite/community/c2/channel/9")).toBe(
            "chats: chats@/favourite > conversation@/favourite/community/c2/channel/9",
        );
    });

    test("a community is the Communities tab's root, and its channels are pushed over it", () => {
        expect(stack("/community/c2")).toBe("communities: communities@/community/c2");
        expect(stack("/community/c2/channel/9")).toBe(
            "communities: communities@/community/c2 > conversation@/community/c2/channel/9",
        );
    });

    test("the followed threads (?threads) are pushed over their list", () => {
        expect(stack("/chats?threads")).toBe("chats: chats@/chats > threads@/chats?threads");
        expect(stack("/community/c2?threads")).toBe(
            "communities: communities@/community/c2 > threads@/community/c2?threads",
        );
        // a thread opened from the list keeps it under the conversation
        expect(stack("/community/c2/channel/9/12?open=true&threads")).toBe(
            "communities: communities@/community/c2 > threads@/community/c2?threads > conversation@/community/c2/channel/9 > thread@/community/c2/channel/9/12?open=true&threads",
        );
    });

    test("Explore is pushed over the Communities tab's community, or is its root without one", () => {
        expect(stack("/communities")).toBe(
            "communities: communities@/community/c1 > explore@/communities",
        );
        expect(stack("/communities?q=dao")).toBe(
            "communities: communities@/community/c1 > explore@/communities?q=dao",
        );
        expect(stack("/welcome", { signedOut: false, community: undefined })).toBe(
            "communities: explore@/welcome",
        );
        const root = at("/communities", { signedOut: false, community: undefined });
        // keyed as the tab's root, so a community taking its place replaces it
        expect(root.area === "tabs" && root.steps[0].key).toBe("communities");
    });

    test("the wallet's pages are the Wallet tab's stack", () => {
        expect(stack("/wallet")).toBe("wallet: wallet@/wallet");
        expect(stack("/wallet/ryjl3-tyaaa-aaaaa-aaaba-cai")).toBe(
            "wallet: wallet@/wallet > token@/wallet/ryjl3-tyaaa-aaaaa-aaaba-cai",
        );
        expect(stack("/wallet/recipients")).toBe(
            "wallet: wallet@/wallet > recipients@/wallet/recipients",
        );
        expect(stack("/wallet/send")).toBe("wallet: wallet@/wallet > wallet_flow@/wallet/send");
    });

    test("Send / Receive / Swap from a token's page are pushed over it", () => {
        expect(stack("/wallet/swap?token=ledger1")).toBe(
            "wallet: wallet@/wallet > token@/wallet/ledger1 > wallet_flow@/wallet/swap?token=ledger1",
        );
    });

    test("activity is the Activity tab, the profile the You tab", () => {
        expect(stack("/notifications")).toBe("activity: activity@/notifications");
        expect(stack("/profile_summary")).toBe("you: you@/profile_summary");
        // the web's profile dialog, over whatever page
        expect(stack("/chats/user/u1?profile")).toBe("you: you@/chats/user/u1?profile");
        expect(stack("/admin")).toBe("you: you@/profile_summary > admin@/admin");
    });

    test("a share, and / signed in, are the Chats tab", () => {
        expect(stack("/share?title=a&text=b&url=c")).toBe(
            "chats: chats@/share?title=a&text=b&url=c",
        );
        expect(stack("/")).toBe("chats: chats@/");
    });

    test("the marketing pages, and / signed out, are outside the tabs", () => {
        expect(stack("/home")).toBe("marketing");
        expect(stack("/blog/some-post")).toBe("marketing");
        expect(stack("/", { signedOut: true, community: undefined })).toBe("marketing");
    });

    test("a path the table doesn't know is not found", () => {
        expect(stack("/a/b/c/d/e")).toBe("not_found");
    });

    test("a screen's key stays the same whatever its URL's details", () => {
        const keys = (url: string) => {
            const location = at(url);
            return location.area === "tabs" ? location.steps.map((s) => s.key) : [];
        };
        expect(keys("/chats/group/g1/57")).toEqual(keys("/chats/group/g1"));
        expect(keys("/group/g1")).toEqual(keys("/chats/group/g1"));
        expect(keys("/community/c2")).toEqual(keys("/community/c3"));
        expect(keys("/chats/user/u1")).not.toEqual(keys("/chats/user/u2"));
    });
});

describe("the tab bar", () => {
    const shown = (url: string) => {
        const location = at(url);
        return location.area === "tabs" && !location.steps.some((s) => hidesTabBar(s.screen));
    };

    test("hides inside a conversation and what's over it", () => {
        expect(shown("/chats/user/u1")).toBe(false);
        expect(shown("/community/c2/channel/9")).toBe(false);
        expect(shown("/chats/group/g1/57?open=true")).toBe(false);
    });

    test("stays on the tabs' roots and their other screens", () => {
        for (const url of [
            "/chats",
            "/chats?threads",
            "/communities",
            "/wallet/ledger1",
            "/admin",
        ]) {
            expect(shown(url), url).toBe(true);
        }
    });
});

describe("where a tab opens without a stack", () => {
    test("is its root's URL", () => {
        expect(NATIVE_TABS.map((tab) => tabRootUrl(tab, community("c1")))).toEqual([
            "/chats",
            "/community/c1",
            "/wallet",
            "/notifications",
            "/profile_summary",
        ]);
    });

    test("is Explore for Communities without a community", () => {
        expect(tabRootUrl("communities", undefined)).toBe("/welcome");
    });

    test("is where that URL puts the tab", () => {
        for (const tab of NATIVE_TABS) {
            const location = at(tabRootUrl(tab, community("c1")));
            expect(location.area === "tabs" && location.tab, tab).toBe(tab);
            expect(location.area === "tabs" && location.steps.length, tab).toBe(1);
        }
    });
});
