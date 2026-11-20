import type { ChannelIdentifier, ChatIdentifier } from "@client";
import { describe, expect, test } from "vitest";
import { openingChannelStep, type OpeningChannel } from "./openingChannel";

const channel = (channelId: number): ChannelIdentifier => ({
    kind: "channel",
    communityId: "comm_1",
    channelId,
});
const general = channel(1);
const readingList = channel(2);
const offTopic = channel(3);
const group: ChatIdentifier = { kind: "group_chat", groupId: "group_1" };

const opening: OpeningChannel = { channelId: readingList, from: general };

describe("the channel the community's Manage is opening", () => {
    test("is handed off to once it's the open chat", () => {
        expect(openingChannelStep(opening, readingList, true)).toBe("hand_off");
    });

    test("is waited for while the chat it was picked from is still open", () => {
        expect(openingChannelStep(opening, general, false)).toBe("wait");
    });

    test("is waited for while it's selected but still loading", () => {
        expect(openingChannelStep(opening, readingList, false)).toBe("wait");
    });

    test("is waited for while no chat is selected", () => {
        expect(openingChannelStep(opening, undefined, false)).toBe("wait");
    });

    test("is given up once another chat is open instead", () => {
        expect(openingChannelStep(opening, offTopic, false)).toBe("give_up");
        expect(openingChannelStep(opening, group, false)).toBe("give_up");
    });

    test("picked with no chat open, is given up once another chat is", () => {
        const fromNone: OpeningChannel = { channelId: readingList, from: undefined };
        expect(openingChannelStep(fromNone, undefined, false)).toBe("wait");
        expect(openingChannelStep(fromNone, general, false)).toBe("give_up");
    });
});
