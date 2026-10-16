import type { RouteParams } from "@client";
import page from "page";
import { pathToRouteKind } from "@src/utils/navigation";
import { routeTable } from "./routeTable";

// What Route needs of its page.js instance, which page.js doesn't expose: decoding the URL's parts
// as page.js does by default
const decoder = {
    _decodeURLEncodedURIComponent: (value: unknown) =>
        typeof value === "string" ? decodeURIComponent(value.replace(/\+/g, " ")) : value,
} as unknown as PageJS.Static;

// What page.js would make of a URL: the first entry whose path matches, as the router registers them
function resolve(url: string): RouteParams {
    const [pathname, querystring = ""] = url.split("?");
    for (const entry of routeTable) {
        const params: Record<string, string> = {};
        // page.js's typings leave out Route's third argument, the instance it decodes with
        const Route = page.Route as unknown as new (
            path: string,
            options: undefined,
            page: PageJS.Static,
        ) => PageJS.Route;
        if (new Route(entry.path, undefined, decoder).match(pathname, params)) {
            return entry.parse({ params, querystring, pathname, path: url } as PageJS.Context);
        }
    }
    throw new Error(`no route for ${url}`);
}

const kind = (url: string) => resolve(url).kind;

describe("the web UI's route table", () => {
    test("keeps every path of the existing desktop router", () => {
        expect(
            [
                "/",
                "/home",
                "/features",
                "/roadmap",
                "/blog",
                "/blog/android-beta",
                "/whitepaper",
                "/guidelines",
                "/terms",
                "/privacy",
                "/faq",
                "/diamond",
                "/architecture",
                "/csea-reporting",
                "/communities",
                "/chats",
                "/favourite",
                "/share",
                "/admin",
            ].map(kind),
        ).toEqual([
            "home_route",
            "home_landing_route",
            "features_route",
            "roadmap_route",
            "blog_route",
            "blog_route",
            "whitepaper_route",
            "guidelines_route",
            "terms_route",
            "privacy_route",
            "faq_route",
            "diamond_route",
            "architecture_route",
            "csea_reporting_route",
            "communities_route",
            "chat_list_route",
            "chat_list_route",
            "share_route",
            "admin_route",
        ]);
    });

    test("selects chats, with their message and thread deep links", () => {
        expect(resolve("/chats/group/abc/42/7?open=true")).toMatchObject({
            kind: "global_chat_selected_route",
            chatId: { kind: "group_chat", groupId: "abc" },
            messageIndex: 42,
            threadMessageIndex: 7,
            open: true,
            scope: { kind: "chats" },
        });
        expect(resolve("/user/u1")).toMatchObject({
            chatId: { kind: "direct_chat", userId: "u1" },
            scope: { kind: "chats" },
        });
        expect(resolve("/favourite/group/abc")).toMatchObject({
            kind: "global_chat_selected_route",
            scope: { kind: "favourite" },
        });
        expect(resolve("/community/c1/channel/5/10")).toMatchObject({
            kind: "selected_channel_route",
            chatId: { kind: "channel", communityId: "c1", channelId: 5 },
            messageIndex: 10,
            scope: { kind: "community" },
        });
        expect(resolve("/community/c1")).toMatchObject({
            kind: "selected_community_route",
            communityId: { kind: "community", communityId: "c1" },
        });
    });

    test("routes the wallet's views and token pages", () => {
        expect(resolve("/wallet")).toMatchObject({ kind: "wallet_route", view: "all" });
        expect(resolve("/wallet/send?token=ryjl3-tyaaa-aaaaa-aaaba-cai")).toMatchObject({
            view: "send",
            ledger: "ryjl3-tyaaa-aaaaa-aaaba-cai",
        });
        expect(resolve("/wallet/receive")).toMatchObject({ view: "receive", ledger: undefined });
        expect(resolve("/wallet/swap")).toMatchObject({ view: "swap" });
        expect(resolve("/wallet/recipients")).toMatchObject({ view: "recipients" });
        expect(resolve("/wallet/ryjl3-tyaaa-aaaaa-aaaba-cai")).toMatchObject({
            view: "token",
            ledger: "ryjl3-tyaaa-aaaaa-aaaba-cai",
        });
    });

    test("routes each scope's threads", () => {
        expect(resolve("/chats/threads")).toEqual({
            kind: "threads_route",
            scope: { kind: "chats" },
        });
        expect(resolve("/favourite/threads")).toEqual({
            kind: "threads_route",
            scope: { kind: "favourite" },
        });
        expect(resolve("/community/c1/threads")).toEqual({
            kind: "threads_route",
            scope: { kind: "community", id: { kind: "community", communityId: "c1" } },
        });
    });

    test("routes mobile's paths, which the legacy route used to take as group ids", () => {
        expect(["/notifications", "/profile_summary", "/welcome", "/wallet"].map(kind)).toEqual([
            "notifications_route",
            "profile_summary_route",
            "welcome_route",
            "wallet_route",
        ]);
    });

    test("still takes an unknown short path as a legacy group link", () => {
        expect(resolve("/abc/3")).toMatchObject({
            kind: "global_chat_selected_route",
            chatId: { kind: "group_chat", groupId: "abc" },
            messageIndex: 3,
        });
    });

    test("ends with not found for anything else", () => {
        expect(kind("/a/b/c/d")).toBe("not_found_route");
    });

    // navigation.ts decides push / pop / replace from its own list of the app's paths (shared with
    // the existing trees, which read some of them differently), so a path added here must be added
    // there too
    test("every app path is one navigation knows", () => {
        // the existing trees read these differently: "/" and /favourite as chat lists
        const readDifferently = ["/", "/favourite"];
        const outsideTheApp = ["*", "/:chatId/:messageIndex?/:threadMessageIndex?"];
        for (const { path } of routeTable) {
            if (readDifferently.includes(path) || outsideTheApp.includes(path)) continue;
            const url = path.replace(/\/:\w+\?/g, "").replace(/:\w+/g, "1");
            const kind = resolve(url).kind;
            if (kind.endsWith("_route") && pathToRouteKind(url) === "not_found_route") {
                // marketing pages aren't in navigation's list, and don't need to be
                const marketing = [
                    "home_landing_route",
                    "features_route",
                    "roadmap_route",
                    "blog_route",
                    "whitepaper_route",
                    "guidelines_route",
                    "terms_route",
                    "privacy_route",
                    "faq_route",
                    "diamond_route",
                    "architecture_route",
                    "csea_reporting_route",
                ];
                expect(marketing, `${path} is missing from navigation's ROUTE_MATCHERS`).toContain(
                    kind,
                );
                continue;
            }
            expect(pathToRouteKind(url), path).toBe(kind);
        }
    });
});
