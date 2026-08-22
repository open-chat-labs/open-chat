// Characterisation tests for the community/channel summary merge that runs on every
// getUpdates cycle. Fixtures are deliberately partial (cast) — only the fields the merge reads.
import type {
    ChannelSummary,
    CommunityCanisterCommunitySummaryUpdates,
    CommunitySummary,
    Mention,
} from "@shared";
import { mergeCommunityUpdates } from "./community";

function mention(index: number): Mention {
    return { messageId: BigInt(index), eventIndex: index, messageIndex: index };
}

const communityId = { kind: "community", communityId: "c1" } as const;
const channelId = { kind: "channel", communityId: "c1", channelId: 1 } as const;

function community(): CommunitySummary {
    const channel = {
        kind: "channel",
        id: channelId,
        eventsTtlLastUpdated: BigInt(0),
        membership: {
            mentions: [mention(1)],
            latestThreads: [
                { threadRootMessageIndex: 3, lastUpdated: BigInt(0) },
                { threadRootMessageIndex: 4, lastUpdated: BigInt(0) },
            ],
        },
    } as unknown as ChannelSummary;
    return {
        kind: "community",
        id: communityId,
        avatar: {},
        banner: {},
        membership: {},
        channels: [channel],
    } as unknown as CommunitySummary;
}

function update(
    mentions: Mention[],
    unfollowedThreads: number[] = [],
): CommunityCanisterCommunitySummaryUpdates {
    return {
        id: communityId,
        channelsUpdated: [
            {
                id: channelId,
                membership: { mentions, unfollowedThreads, latestThreads: [] },
            },
        ],
    } as unknown as CommunityCanisterCommunitySummaryUpdates;
}

describe("mergeCommunityUpdates channel membership", () => {
    test("prepends new mentions onto existing ones, deduped by messageId", () => {
        const out = mergeCommunityUpdates([community()], [], [update([mention(7), mention(1)])]);
        expect(out[0].channels[0].membership.mentions.map((m) => m.messageIndex)).toEqual([7, 1]);
    });

    test("caps merged mentions at 50 keeping the newest", () => {
        const incoming = Array.from({ length: 60 }, (_, i) => mention(110 - i));
        const out = mergeCommunityUpdates([community()], [], [update(incoming)]);
        const idxs = out[0].channels[0].membership.mentions.map((m) => m.messageIndex);
        expect(idxs.length).toBe(50);
        expect(idxs[0]).toBe(110);
        expect(idxs[49]).toBe(61);
    });

    test("channel update without membership leaves mentions untouched", () => {
        const out = mergeCommunityUpdates(
            [community()],
            [],
            [
                {
                    id: communityId,
                    channelsUpdated: [{ id: channelId }],
                } as unknown as CommunityCanisterCommunitySummaryUpdates,
            ],
        );
        expect(out[0].channels[0].membership.mentions.map((m) => m.messageIndex)).toEqual([1]);
    });

    test("drops unfollowed threads from latestThreads", () => {
        const out = mergeCommunityUpdates([community()], [], [update([], [3])]);
        expect(
            out[0].channels[0].membership.latestThreads.map((t) => t.threadRootMessageIndex),
        ).toEqual([4]);
    });
});
