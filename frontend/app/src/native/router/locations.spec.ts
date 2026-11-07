import type { CommunityIdentifier } from "@client";
import { resolve } from "@src/utils/routeTable.testing";
import {
    showsTabBar,
    locationFor,
    NATIVE_TABS,
    openChat,
    tabRootStep,
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

    test("the marketing pages are outside the tabs, signed in or out", () => {
        const signedOut = { signedOut: true, community: undefined };
        expect(stack("/home")).toBe("marketing");
        expect(stack("/blog/some-post")).toBe("marketing");
        expect(stack("/home", signedOut)).toBe("marketing");
        expect(stack("/faq", signedOut)).toBe("marketing");
    });

    test("signed out, anything else is the signed-out start: no guest mode", () => {
        const signedOut = { signedOut: true, community: undefined };
        expect(stack("/", signedOut)).toBe("signed_out");
        expect(stack("/chats", signedOut)).toBe("signed_out");
        expect(stack("/group/g1", signedOut)).toBe("signed_out");
        expect(stack("/communities", signedOut)).toBe("signed_out");
        expect(stack("/a/b/c/d/e", signedOut)).toBe("signed_out");
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
        expect(keys("/chats/user/u1")).not.toEqual(keys("/chats/user/u2"));
    });

    test("another root is another screen: a community or another, Explore, Favourites", () => {
        const root = (url: string, context: LocationContext = signedIn) => {
            const location = at(url, context);
            return location.area === "tabs" ? location.steps[0].key : undefined;
        };
        expect(root("/community/c2")).not.toEqual(root("/community/c3"));
        expect(root("/community/c2/channel/9")).toEqual(root("/community/c2"));
        expect(root("/communities", { signedOut: false, community: undefined })).not.toEqual(
            root("/community/c2"),
        );
        expect(root("/favourite")).not.toEqual(root("/chats"));
        expect(root("/chats/group/g1")).toEqual(root("/chats"));
    });
});

describe("the tab bar", () => {
    const shown = (url: string) => {
        const location = at(url);
        return location.area === "tabs" && showsTabBar(location.steps);
    };

    test("shows on the tabs' roots", () => {
        for (const url of [
            "/chats",
            "/favourite",
            "/wallet",
            "/notifications",
            "/profile_summary",
        ]) {
            expect(shown(url), url).toBe(true);
        }
    });

    test("hides on every pushed screen, not only a conversation", () => {
        for (const url of [
            "/chats/user/u1",
            "/community/c2/channel/9",
            "/chats/group/g1/57?open=true",
            "/chats?threads",
            "/wallet/ledger1",
        ]) {
            expect(shown(url), url).toBe(false);
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

describe("a tab's root before it's opened", () => {
    // a swipe draws it with this; the tab then opens on the same screen, not a new one
    test.each([
        ["with a community", community("c1")],
        ["without one", undefined],
    ])("is the root the tab opens on (%s)", (_, inCommunity) => {
        const context: LocationContext = { signedOut: false, community: inCommunity };
        for (const tab of NATIVE_TABS) {
            const location = at(tabRootUrl(tab, inCommunity), context);
            if (location.area !== "tabs") throw new Error(`${tab}'s root isn't in the tabs`);
            expect(tabRootStep(tab, inCommunity)).toEqual(location.steps[0]);
        }
    });
});

describe("the chat a stack has open", () => {
    const opened = (url: string) => {
        const location = at(url);
        if (location.area !== "tabs") throw new Error(`${url} isn't in the tabs`);
        return openChat(location);
    };

    test("is its conversation's, a thread in it included", () => {
        expect(opened("/chats/user/u1")).toEqual({ kind: "direct_chat", userId: "u1" });
        expect(opened("/chats/group/g1/3?open=true")).toEqual({ kind: "group_chat", groupId: "g1" });
    });

    test("is none on a list", () => {
        expect(opened("/chats")).toBeUndefined();
        expect(opened("/wallet")).toBeUndefined();
    });
});
