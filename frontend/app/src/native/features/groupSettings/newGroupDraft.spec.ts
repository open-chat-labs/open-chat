import { describe, expect, test } from "vitest";
import { UpdateGroupState } from "@src/logic/groupOrCommunity/group.svelte";
import { holdNewGroup, newGroupDraft } from "./newGroupDraft";

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
