import { describe, expect, test } from "vitest";
import { UpdateGroupState } from "@src/logic/groupOrCommunity/group.svelte";
import type { CandidateGroupChat } from "@client";
import { holdNewGroup, newChannelCandidate, newGroupDraft } from "./newGroupDraft";

describe("Create group's draft", () => {
    test("held while its screen is open, and let go as it goes", () => {
        const draft = new UpdateGroupState();
        const release = holdNewGroup(draft);
        expect(newGroupDraft()).toBe(draft);
        release();
        expect(newGroupDraft()).toBeUndefined();
    });

    // a second Create group (pushed again from New chat) holds its own; the first going doesn't
    // take the second's away
    test("a newer screen's draft outlives an older one going", () => {
        const first = new UpdateGroupState();
        const second = new UpdateGroupState();
        const releaseFirst = holdNewGroup(first);
        const releaseSecond = holdNewGroup(second);
        releaseFirst();
        expect(newGroupDraft()).toBe(second);
        releaseSecond();
        expect(newGroupDraft()).toBeUndefined();
    });

    // Invariant: while a Create group is open, its pages find a draft: the second going gives
    // the first its own back
    test("the older screen's draft is back once the newer one goes", () => {
        const first = new UpdateGroupState();
        const second = new UpdateGroupState();
        const releaseFirst = holdNewGroup(first);
        const releaseSecond = holdNewGroup(second);
        releaseSecond();
        expect(newGroupDraft()).toBe(first);
        releaseSecond();
        expect(newGroupDraft()).toBe(first);
        releaseFirst();
        expect(newGroupDraft()).toBeUndefined();
    });
});

describe("a new channel's blank", () => {
    const blank = (id: CandidateGroupChat["id"]) => ({ id }) as CandidateGroupChat;
    const community = { kind: "community" as const, communityId: "c1" };

    test("the client's, where it's a channel in the community", () => {
        const channel = blank({ kind: "channel", communityId: "c1", channelId: 0 });
        expect(newChannelCandidate(channel, community)).toBe(channel);
    });

    test("none for another community's, a group, or none at all", () => {
        expect(
            newChannelCandidate(blank({ kind: "channel", communityId: "c2", channelId: 0 }), community),
        ).toBeUndefined();
        expect(
            newChannelCandidate(blank({ kind: "group_chat", groupId: "" }), community),
        ).toBeUndefined();
        expect(newChannelCandidate(undefined, community)).toBeUndefined();
    });
});
