import type { CandidateGroupChat } from "@client";
import { describe, expect, test } from "vitest";
import { newChannelCandidate } from "./newChannel";

const blank = {
    id: { kind: "channel", communityId: "c", channelId: 0 },
    kind: "candidate_group_chat",
    name: "",
    description: "",
    public: false,
    historyVisible: true,
    level: "channel",
    externalUrl: undefined,
} as unknown as CandidateGroupChat;

describe("a new channel", () => {
    // what's sent: the form's name, description and visibility; a URL only for an embedded channel
    test("is the form's channel, with a URL only when embedded", () => {
        const form = {
            name: " hikes ",
            about: "Weekend walks ",
            isPublic: true,
            url: " https://a.b ",
        };

        const plain = newChannelCandidate(blank, { ...form, embedded: false });
        expect(plain).toMatchObject({ name: "hikes", description: "Weekend walks", public: true });
        expect(plain.externalUrl).toBeUndefined();
        expect(plain.id).toEqual(blank.id);

        expect(newChannelCandidate(blank, { ...form, embedded: true }).externalUrl).toBe(
            "https://a.b",
        );
    });
});
