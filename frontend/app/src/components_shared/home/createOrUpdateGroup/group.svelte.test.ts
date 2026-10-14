import {
    candidateGroupFromChat,
    defaultChatPermissions,
    defaultChatRules,
    nullMembership,
    ROLE_OWNER,
    type CandidateGroupChat,
    type GroupChangeConfirmation,
    type MultiUserChat,
    type OpenChat,
    type UpdateGroupOutcome,
} from "@client";
import { describe, expect, test, vi } from "vitest";
import { UpdateGroupState } from "./group.svelte";

const group: CandidateGroupChat = {
    id: { kind: "group_chat", groupId: "rrkah-fqaaa-aaaaa-aaaaq-cai" },
    kind: "candidate_group_chat",
    name: "Group",
    description: "",
    historyVisible: true,
    public: false,
    frozen: false,
    members: [],
    permissions: defaultChatPermissions(),
    rules: { ...defaultChatRules("group"), newVersion: false },
    gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
    level: "group",
    membership: { ...nullMembership(), role: ROLE_OWNER },
    messagesVisibleToNonMembers: false,
    externalUrl: undefined,
    verified: true,
};

// Asks for each confirmation the change needs that hasn't been given, as the client does
function fakeClient() {
    const updateGroup = vi.fn(
        async (
            original: CandidateGroupChat,
            candidate: CandidateGroupChat,
            confirmed: GroupChangeConfirmation[] = [],
        ): Promise<UpdateGroupOutcome> => {
            if (candidate.name !== original.name && !confirmed.includes("verified_name")) {
                return { kind: "needs_confirmation", confirmation: "verified_name" };
            }
            if (candidate.public !== original.public && !confirmed.includes("visibility")) {
                return { kind: "needs_confirmation", confirmation: "visibility" };
            }
            return { kind: "success" };
        },
    );
    return { client: { updateGroup } as unknown as OpenChat, updateGroup };
}

describe("saving a group", () => {
    // Invariant: a group whose details are invalid is never sent. The mobile form submits on Enter
    // even while its save button is disabled.
    test("a group with invalid rules is not saved", async () => {
        const { client, updateGroup } = fakeClient();
        const state = new UpdateGroupState();
        state.initialise(structuredClone(group));
        state.candidateGroup.description = "changed";
        state.candidateGroup.rules.enabled = true;
        state.candidateGroup.rules.text = "";

        expect((await state.saveGroup(client)).kind).toBe("invalid");
        expect(updateGroup).not.toHaveBeenCalled();
    });

    // Invariant: every confirmation the user gives while saving is kept until the save goes through
    test("a change needing two confirmations is saved once both are given", async () => {
        const { client, updateGroup } = fakeClient();
        const state = new UpdateGroupState();
        state.initialise(structuredClone(group));
        state.candidateGroup.name = "Renamed";
        state.candidateGroup.public = true;

        await state.saveGroup(client);
        expect(state.showingVerificationWarning).toBe(true);
        await state.saveGroup(client, true);
        expect(state.confirming).toBe(true);
        expect((await state.saveGroup(client, true)).kind).toBe("success");
        expect(updateGroup).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), [
            "verified_name",
            "visibility",
        ]);
    });
});

describe("editing a group", () => {
    // Invariant: a group can be edited from wherever its chat comes from. Mobile's details page gets
    // the chat from the sliding page stack, which is reactive state, and structuredClone throws on
    // the proxies Svelte wraps it in.
    test("a chat held in reactive state can be turned into a group to edit", () => {
        const chat = $state({
            ...group,
            kind: "group_chat",
            gateConfig: { gate: { kind: "diamond_gate" }, expiry: undefined },
        }) as unknown as MultiUserChat;

        const candidate = candidateGroupFromChat(chat, undefined);

        expect(candidate.permissions).toEqual(group.permissions);
        expect(candidate.gateConfig.gate.kind).toBe("diamond_gate");
    });
});
