import type { ChannelIdentifier, ChannelMatch } from "@client";
import { describe, expect, test } from "vitest";
import { canReadChannel, otherChannels } from "./otherChannels";

function channel(channelId: number, flags: Partial<ChannelMatch> = {}): ChannelMatch {
    return {
        id: { kind: "channel", communityId: "c", channelId },
        name: `channel ${channelId}`,
        public: true,
        invited: false,
        ...flags,
    } as ChannelMatch;
}

describe("a community's other channels", () => {
    test("are those found the user isn't in, in the order found", () => {
        const joined = new Set([2]);
        const has = (id: ChannelIdentifier) => joined.has(id.channelId);
        const found = otherChannels([channel(3), channel(2), channel(1)], { has });
        expect(found.map((c) => c.id.channelId)).toEqual([3, 1]);
    });

    test("can be read when public, or private and invited to", () => {
        expect(canReadChannel(channel(1))).toBe(true);
        expect(canReadChannel(channel(1, { public: false }))).toBe(false);
        expect(canReadChannel(channel(1, { public: false, invited: true }))).toBe(true);
    });
});
