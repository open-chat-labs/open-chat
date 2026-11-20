import { describe, expect, test } from "vitest";
import { UpdateGroupState } from "@src/logic/groupOrCommunity/group.svelte";
import { holdNewGroup, NewGroupDraft, newGroupDraft } from "./newGroupDraft.svelte";

describe("Create group's draft", () => {
    test("held while its screen is open, and let go as it goes", () => {
        const draft = new NewGroupDraft(new UpdateGroupState());
        const release = holdNewGroup(draft);
        expect(newGroupDraft()).toBe(draft);
        release();
        expect(newGroupDraft()).toBeUndefined();
    });

    // a second Create group (pushed again from New chat) holds its own; the first going doesn't
    // take the second's away
    test("a newer screen's draft outlives an older one going", () => {
        const first = new NewGroupDraft(new UpdateGroupState());
        const second = new NewGroupDraft(new UpdateGroupState());
        const releaseFirst = holdNewGroup(first);
        const releaseSecond = holdNewGroup(second);
        releaseFirst();
        expect(newGroupDraft()).toBe(second);
        releaseSecond();
    });

    // Invariant: Create group is covered exactly while a page it pushed is open over it
    test("covered while a page is over it, each page closing once", () => {
        const draft = new NewGroupDraft(new UpdateGroupState());
        expect(draft.covered).toBe(false);
        const closeFirst = draft.openPage();
        const closeSecond = draft.openPage();
        closeFirst();
        closeFirst();
        expect(draft.covered).toBe(true);
        closeSecond();
        expect(draft.covered).toBe(false);
    });
});
