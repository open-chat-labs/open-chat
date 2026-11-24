import type {
    ChannelMatch,
    CombinedUnreadCounts,
    CommunityIdentifier,
    CommunitySummary,
} from "@client";
import { CommunityMap } from "@client";
import { describe, expect, test } from "vitest";
import {
    channelsNotJoined,
    communityAction,
    communityKey,
    communityManageRows,
    headerMenuItems,
    matchingCommunities,
    nextCommunity,
    notJoinedRow,
    rowMenuItems,
    shownAsPreview,
    switcherCommunities,
    type CommunityMenuState,
} from "./community.adapter";

const all: CommunityMenuState = {
    canInvite: true,
    canManage: true,
    canLeave: true,
};
const label = (a: string) => a;

describe("the community's menus", () => {
    test("the header's kebab: Invite, Mute all, Mark all as read, Manage, Leave", () => {
        expect(headerMenuItems(all, label).map((i) => i.id)).toEqual([
            "invite",
            "mute_all",
            "mark_all_read",
            "manage",
            "leave",
        ]);
        const leave = headerMenuItems(all, label).at(-1);
        expect(leave).toMatchObject({ danger: true, separator: true });
    });

    // a plain member: Invite only where the community's permissions let members invite
    test("a member who can't invite or manage: Mute all channels, Mark all as read, Leave", () => {
        const member = { ...all, canInvite: false, canManage: false };
        expect(headerMenuItems(member, label).map((i) => i.id)).toEqual([
            "mute_all",
            "mark_all_read",
            "leave",
        ]);
    });

    test("a community's long-press: Move to top but for the first", () => {
        expect(rowMenuItems(all, false, label)[0].id).toBe("move_to_top");
        expect(rowMenuItems(all, true, label).map((i) => i.id)).not.toContain("move_to_top");
        expect(rowMenuItems(all, true, label).map((i) => i.id)).not.toContain("invite");
    });

    test("the details' Manage: every settings page, in the plan's order", () => {
        expect(communityManageRows(label).map((r) => r.page)).toEqual([
            "channels",
            "user_groups",
            "invite",
            "gates",
            "rules",
            "permissions",
            "bots",
            "stats",
        ]);
    });

    test("a picked row's action", () => {
        expect(communityAction("manage")).toBe("manage");
        expect(communityAction("nonsense")).toBeUndefined();
    });
});

function match(channelId: number, flags: Partial<ChannelMatch> = {}): ChannelMatch {
    return {
        id: { kind: "channel", communityId: "c", channelId },
        name: `channel ${channelId}`,
        public: true,
        invited: false,
        avatar: { blobUrl: undefined },
        ...flags,
    } as ChannelMatch;
}

describe("the channels not joined", () => {
    test("are those found the user isn't in and can read", () => {
        const joined = { has: (id: ChannelMatch["id"]) => id.channelId === 1 };
        const found = [
            match(1),
            match(2),
            match(3, { public: false }),
            match(4, { public: false, invited: true }),
        ];
        expect(channelsNotJoined(found, joined).map((c) => c.id.channelId)).toEqual([2, 4]);
    });

    test("show a lock when private", () => {
        expect(notJoinedRow(match(4, { public: false, invited: true }))).toMatchObject({
            key: "c/4",
            title: "channel 4",
            locked: true,
        });
    });
});

function community(id: string, name = id): CommunitySummary {
    return {
        kind: "community",
        id: { kind: "community", communityId: id },
        name,
        avatar: { blobUrl: undefined },
        public: true,
        memberCount: 3,
    } as CommunitySummary;
}

function counts(unmuted: number): CombinedUnreadCounts {
    const none = { muted: 0, unmuted: 0, mentions: false };
    return { chats: { ...none, unmuted }, threads: none };
}

describe("a community shown as a preview, over Explore", () => {
    const previewing = (c: CommunitySummary) => c.id.communityId === "p";

    test("one being previewed", () => {
        expect(shownAsPreview(community("p"), true, previewing)).toBe(true);
        expect(shownAsPreview(community("a"), true, previewing)).toBe(false);
    });

    // tapped in Explore, it's previewed a moment later: over Explore from the start (no slide back)
    test("one the client doesn't have yet, once the user's communities are in", () => {
        expect(shownAsPreview(undefined, true, previewing)).toBe(true);
    });

    // a cold start: the user's own community, not loaded yet
    test("not before the user's communities are in", () => {
        expect(shownAsPreview(undefined, false, previewing)).toBe(false);
    });
});

describe("the switcher's communities", () => {
    const id = (communityId: string): CommunityIdentifier => ({ kind: "community", communityId });

    test("in their order, the current one marked, with their unread counts", () => {
        const unread = new CommunityMap<CombinedUnreadCounts>();
        unread.set(id("b"), counts(4));
        const listed = switcherCommunities(
            [community("a"), community("b"), community("p"), community("left")],
            id("b"),
            unread,
            (c) => c.id.communityId === "p",
            (key) => key === communityKey(id("left")),
            () => "Public · 3 members",
        );
        expect(listed.map((c) => [c.key, c.current, c.unread])).toEqual([
            ["community/a", false, 0],
            ["community/b", true, 4],
        ]);
        expect(listed[0].sub).toBe("Public · 3 members");
    });

    test("searched by name", () => {
        const list = [{ name: "Meme Factory" }, { name: "Book club" }];
        expect(matchingCommunities(list, " meme ")).toEqual([{ name: "Meme Factory" }]);
        expect(matchingCommunities(list, "")).toEqual(list);
    });

    test("leaving one moves on to the next, else the one before, else none", () => {
        const list = [{ id: id("a") }, { id: id("b") }, { id: id("c") }];
        expect(nextCommunity(list, id("b"))).toEqual(id("c"));
        expect(nextCommunity(list, id("c"))).toEqual(id("b"));
        expect(nextCommunity([{ id: id("a") }], id("a"))).toBeUndefined();
    });
});
