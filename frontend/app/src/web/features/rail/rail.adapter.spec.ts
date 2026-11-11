import {
    emptyCombinedUnreadCounts,
    type CombinedUnreadCounts,
    type CommunityIdentifier,
    type CommunitySummary,
    type ReadonlyMap,
    type UnreadCounts,
} from "@client";
import { pinsFor, railItemUnread, type RailUnread } from "./rail.adapter";

const community = (communityId: string, name: string, avatar?: string) =>
    ({
        id: { kind: "community", communityId },
        name,
        avatar: { blobUrl: avatar },
    }) as CommunitySummary;

function countsOf(entries: [string, CombinedUnreadCounts][]) {
    const byId = new Map(entries);
    return {
        get: (id: CommunityIdentifier) => byId.get(id.communityId),
    } as ReadonlyMap<CommunityIdentifier, CombinedUnreadCounts>;
}

const none = countsOf([]);

const chats = (counts: Partial<UnreadCounts>): CombinedUnreadCounts => ({
    ...emptyCombinedUnreadCounts(),
    chats: { muted: 0, unmuted: 0, mentions: false, ...counts },
});

const threads = (counts: Partial<UnreadCounts>): CombinedUnreadCounts => ({
    ...emptyCombinedUnreadCounts(),
    threads: { muted: 0, unmuted: 0, mentions: false, ...counts },
});

describe("the rail's pins", () => {
    test("are the communities, in order, by id", () => {
        const pins = pinsFor([community("c2", "Second"), community("c1", "First")], none);
        expect(pins.map((p) => [p.id, p.name])).toEqual([
            ["c2", "Second"],
            ["c1", "First"],
        ]);
    });

    test("carry the community's own picture, and none (the swatch) without one", () => {
        const [withOne, without] = pinsFor(
            [community("c1", "First", "https://blobs/c1"), community("c2", "Second")],
            none,
        );
        expect(withOne.avatarUrl).toBe("https://blobs/c1");
        expect(without.avatarUrl).toBeUndefined();
    });

    test("keep the same fallback colour for a community", () => {
        const colour = (id: string) => pinsFor([community(id, "x")], none)[0].color;
        expect(colour("c1")).toBe(colour("c1"));
        expect(new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map(colour)).size).toBeGreaterThan(
            1,
        );
    });

    test("have a dot while a channel has unmuted unread messages or a mention", () => {
        const dots = pinsFor(
            [
                community("unread", "a"),
                community("mention", "b"),
                community("muted", "c"),
                community("thread", "d"),
                community("none", "e"),
            ],
            countsOf([
                ["unread", chats({ unmuted: 2 })],
                ["mention", chats({ mentions: true })],
                ["muted", chats({ muted: 5 })],
                ["thread", threads({ unmuted: 3 })],
            ]),
        ).map((p) => [p.id, p.dot]);
        expect(dots).toEqual([
            ["unread", true],
            ["mention", true],
            ["muted", false],
            ["thread", false],
            ["none", false],
        ]);
    });
});

describe("a rail item's unread mark", () => {
    const unread = (over: Partial<RailUnread>): RailUnread => ({
        directAndGroup: emptyCombinedUnreadCounts(),
        favourite: emptyCombinedUnreadCounts(),
        activity: 0,
        ...over,
    });

    test("is Chats' unmuted unread DMs and groups, not their threads or muted chats", () => {
        expect(railItemUnread("chats", unread({ directAndGroup: chats({ unmuted: 3 }) }))).toEqual({
            dot: true,
            count: 3,
        });
        expect(railItemUnread("chats", unread({ directAndGroup: chats({ muted: 4 }) }))).toEqual({
            dot: false,
        });
        expect(
            railItemUnread("chats", unread({ directAndGroup: threads({ unmuted: 2 }) })),
        ).toEqual({ dot: false });
    });

    test("shows a mention alone as a dot with no number", () => {
        expect(
            railItemUnread("chats", unread({ directAndGroup: chats({ mentions: true }) })),
        ).toEqual({ dot: true });
    });

    test("is Favourites' own count", () => {
        const counts = unread({ favourite: chats({ unmuted: 1 }) });
        expect(railItemUnread("favourites", counts)).toEqual({ dot: true, count: 1 });
        expect(railItemUnread("chats", counts)).toEqual({ dot: false });
    });

    test("is Notifications' unread activity, and nothing on the wallet", () => {
        expect(railItemUnread("notifications", unread({ activity: 2 }))).toEqual({
            dot: true,
            count: 2,
        });
        expect(railItemUnread("notifications", unread({}))).toEqual({ dot: false });
        expect(railItemUnread("wallet", unread({ activity: 2 }))).toEqual({ dot: false });
    });
});
