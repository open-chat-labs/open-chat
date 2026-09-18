import type {
    ChatStateFull,
    CommunityCanisterCommunitySummaryUpdates,
    CommunitySummary,
    GroupAndCommunitySummaryUpdatesResponse,
    GroupAndCommunitySummaryUpdatesResponseBatch,
    GroupCanisterGroupChatSummaryUpdates,
    GroupChatSummary,
} from "@shared";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { mergeGroupChatUpdates } from "./chat";
import { mergeCommunityUpdates } from "./community";
import { applyRefresh, refreshArgs, refreshTarget, type RefreshTarget } from "./refreshChat";

// The merges themselves are covered by the chat and community baseline tests; here they only
// need to show which chat was merged with which update
vi.mock("./chat", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./chat")>()),
    mergeGroupChatUpdates: vi.fn(),
}));
vi.mock("./community", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./community")>()),
    mergeCommunityUpdates: vi.fn(),
}));

const group = (groupId: string, lastUpdated = 1n) =>
    ({
        kind: "group_chat",
        id: { kind: "group_chat", groupId },
        localUserIndex: "lui",
        lastUpdated,
    }) as unknown as GroupChatSummary;

const community = (communityId: string, lastUpdated = 1n) =>
    ({
        kind: "community",
        id: { kind: "community", communityId },
        localUserIndex: "lui",
        lastUpdated,
        channels: [],
    }) as unknown as CommunitySummary;

const state = (groups: GroupChatSummary[], communities: CommunitySummary[]) =>
    ({ groupChats: groups, communities, directChats: [] }) as unknown as ChatStateFull;

const groupUpdates = (groupId: string, eventIndexes: number[] = []) =>
    ({
        id: { kind: "group_chat", groupId },
        lastUpdated: 2n,
        updatedEvents: eventIndexes.map((eventIndex) => ({ eventIndex, timestamp: 2n })),
    }) as unknown as GroupCanisterGroupChatSummaryUpdates;

const communityUpdates = (communityId: string) =>
    ({
        id: { kind: "community", communityId },
        lastUpdated: 2n,
        channelsUpdated: [
            {
                id: { kind: "channel", communityId, channelId: 7 },
                updatedEvents: [{ eventIndex: 3, timestamp: 2n }],
            },
        ],
    }) as unknown as CommunityCanisterCommunitySummaryUpdates;

const batch = (
    updates: GroupAndCommunitySummaryUpdatesResponse[],
    overrides: Partial<GroupAndCommunitySummaryUpdatesResponseBatch> = {},
): GroupAndCommunitySummaryUpdatesResponseBatch => ({
    timestamp: 2n,
    updates,
    excessUpdates: [],
    errors: [],
    notFound: [],
    ...overrides,
});

beforeEach(() => {
    vi.mocked(mergeGroupChatUpdates).mockImplementation((chats) =>
        chats.map((c) => ({ ...c, lastUpdated: 2n })),
    );
    vi.mocked(mergeCommunityUpdates).mockImplementation((communities) =>
        communities.map((c) => ({ ...c, lastUpdated: 2n })),
    );
});

describe("refreshTarget", () => {
    const s = state([group("g1"), group("g2")], [community("c1")]);

    test("a group is its own target, a channel's is its community", () => {
        expect(refreshTarget(s, { kind: "group_chat", groupId: "g2" })).toEqual({
            kind: "group",
            chat: s.groupChats[1],
        });
        expect(refreshTarget(s, { kind: "channel", communityId: "c1", channelId: 7 })).toEqual({
            kind: "community",
            chat: s.communities[0],
        });
    });

    test("a chat that is not cached has no target", () => {
        expect(refreshTarget(s, { kind: "group_chat", groupId: "gx" })).toBeUndefined();
        expect(
            refreshTarget(s, { kind: "channel", communityId: "cx", channelId: 1 }),
        ).toBeUndefined();
    });
});

describe("refreshArgs", () => {
    test("asks for the updates since the cached summary", () => {
        expect(refreshArgs({ kind: "group", chat: group("g1", 5n) })).toEqual({
            canisterId: "g1",
            isCommunity: false,
            inviteCode: undefined,
            updatesSince: 5n,
        });
        expect(refreshArgs({ kind: "community", chat: community("c1", 6n) })).toEqual({
            canisterId: "c1",
            isCommunity: true,
            inviteCode: undefined,
            updatesSince: 6n,
        });
    });
});

describe("applyRefresh", () => {
    test("a group's updates replace only that group and mark only it touched", () => {
        const s = state([group("g1"), group("g2")], [community("c1")]);
        const target: RefreshTarget = { kind: "group", chat: s.groupChats[1] };
        const update = groupUpdates("g2", [4]);

        const result = applyRefresh(s, target, batch([{ kind: "group_updates", value: update }]));

        expect(mergeGroupChatUpdates).toHaveBeenCalledWith([s.groupChats[1]], [], [update]);
        if (result.kind !== "updated") throw new Error(result.kind);
        expect(result.state.groupChats[0]).toBe(s.groupChats[0]);
        expect(result.state.groupChats[1].lastUpdated).toBe(2n);
        expect(result.state.communities).toBe(s.communities);
        expect([...result.touched.groupChats]).toEqual(["g2"]);
        expect(result.touched.communities.size).toBe(0);
        expect(result.touched.directChats.size).toBe(0);
        expect(result.touched.fields.size).toBe(0);
        expect(result.touched.updatedEvents.get(update.id)?.map((e) => e.eventIndex)).toEqual([4]);
        expect(result.chat).toEqual({ kind: "group", chat: result.state.groupChats[1] });
    });

    test("a community's updates replace only that community, with its channels' updated events", () => {
        const s = state([group("g1")], [community("c1"), community("c2")]);
        const target: RefreshTarget = { kind: "community", chat: s.communities[0] };
        const update = communityUpdates("c1");

        const result = applyRefresh(
            s,
            target,
            batch([{ kind: "community_updates", value: update }]),
        );

        expect(mergeCommunityUpdates).toHaveBeenCalledWith([s.communities[0]], [], [update]);
        if (result.kind !== "updated") throw new Error(result.kind);
        expect(result.state.communities[0].lastUpdated).toBe(2n);
        expect(result.state.communities[1]).toBe(s.communities[1]);
        expect(result.state.groupChats).toBe(s.groupChats);
        expect([...result.touched.communities]).toEqual(["c1"]);
        expect(result.touched.groupChats.size).toBe(0);
        expect(
            result.touched.updatedEvents
                .get({ kind: "channel", communityId: "c1", channelId: 7 })
                ?.map((e) => e.eventIndex),
        ).toEqual([3]);
    });

    test("no updates means nothing changed", () => {
        const s = state([group("g1")], []);
        expect(applyRefresh(s, { kind: "group", chat: s.groupChats[0] }, batch([]))).toEqual({
            kind: "unchanged",
        });
    });

    test("anything but updates for the chat asked about is left to a full pass", () => {
        const s = state([group("g1")], [community("c1")]);
        const g: RefreshTarget = { kind: "group", chat: s.groupChats[0] };
        const c: RefreshTarget = { kind: "community", chat: s.communities[0] };
        const ok = [{ kind: "group_updates", value: groupUpdates("g1") }] as const;

        for (const result of [
            applyRefresh(s, g, batch([...ok], { notFound: ["g1"] })),
            applyRefresh(s, g, batch([...ok], { errors: [["g1", {} as never]] })),
            applyRefresh(s, g, batch([...ok], { excessUpdates: ["g1"] })),
            // a full summary rather than updates
            applyRefresh(s, g, batch([{ kind: "group", value: {} as never }])),
            // updates for another chat
            applyRefresh(s, g, batch([{ kind: "group_updates", value: groupUpdates("g2") }])),
            // the wrong kind for the target
            applyRefresh(s, c, batch([...ok])),
        ]) {
            expect(result).toEqual({ kind: "needs_full_pass" });
        }
    });
});
