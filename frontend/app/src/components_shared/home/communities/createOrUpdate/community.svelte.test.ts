import {
    defaultChatRules,
    type CommunityAndRules,
    type CommunitySummary,
    type GroupChangeConfirmation,
    type OpenChat,
    type UpdateCommunityOutcome,
} from "@client";
import { createCandidateCommunity } from "@src/stores/community";
import { describe, expect, test, vi } from "vitest";
import { UpdateCommunityState } from "./community.svelte";

const community: CommunitySummary = {
    ...createCandidateCommunity("rrkah-fqaaa-aaaaa-aaaaq-cai", 1),
    name: "Community",
    public: true,
};

// Asks for each confirmation the change needs that hasn't been given, as the client does
function fakeClient() {
    const updateCommunity = vi.fn(
        async (
            original: CommunityAndRules,
            candidate: CommunityAndRules,
            confirmed: GroupChangeConfirmation[] = [],
        ): Promise<UpdateCommunityOutcome> => {
            if (
                original.community.public &&
                !candidate.community.public &&
                !confirmed.includes("visibility")
            ) {
                return { kind: "needs_confirmation", confirmation: "visibility" };
            }
            return { kind: "success" };
        },
    );
    return { client: { updateCommunity } as unknown as OpenChat, updateCommunity };
}

function editing(): UpdateCommunityState {
    const state = new UpdateCommunityState();
    state.initialise(community, defaultChatRules("community"));
    return state;
}

describe("saving a community", () => {
    // Invariant: a community whose details are invalid is never sent. The mobile form submits on
    // Enter even while its save button is disabled.
    test("a community with invalid rules is not saved", async () => {
        const { client, updateCommunity } = fakeClient();
        const state = editing();
        state.candidateCommunity.description = "changed";
        state.rules.enabled = true;
        state.rules.text = "";

        expect((await state.saveCommunity(client)).kind).toBe("invalid");
        expect(updateCommunity).not.toHaveBeenCalled();
    });

    // Invariant: declining to make a community private leaves it public and sends nothing
    test("declining to make a community private puts it back to public", async () => {
        const { client, updateCommunity } = fakeClient();
        const state = editing();
        state.candidateCommunity.public = false;

        await state.saveCommunity(client);
        expect(state.confirming).toBe(true);
        expect((await state.saveCommunity(client, false)).kind).toBe("declined");

        expect(state.candidateCommunity.public).toBe(true);
        expect(updateCommunity).toHaveBeenCalledTimes(1);
    });
});
