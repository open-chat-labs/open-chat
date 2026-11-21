import {
    defaultChatPermissions,
    defaultChatRules,
    nullMembership,
    ROLE_OWNER,
    type CandidateGroupChat,
    type LeafGate,
} from "@client";
import { describe, expect, test } from "vitest";
import { UpdateGroupState } from "./group.svelte";

function group(gate: CandidateGroupChat["gateConfig"]["gate"]): CandidateGroupChat {
    return {
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
        gateConfig: { gate, expiry: undefined },
        level: "group",
        membership: { ...nullMembership(), role: ROLE_OWNER },
        messagesVisibleToNonMembers: false,
        externalUrl: undefined,
        verified: false,
    };
}

const icp: LeafGate = { kind: "payment_gate", ledgerCanister: "icp", amount: 1n, fee: 0n };
const chit: LeafGate = { kind: "chit_earned_gate", minEarned: 100 };

describe("editing a group's gates", () => {
    // Invariant: changing an entry (a payment's amount) keeps how the gates combine, where taking
    // it off and adding it again would make two gates "and" again
    test("a gate changed in place keeps its place and the gates' operator", () => {
        const state = new UpdateGroupState();
        state.initialise(group({ kind: "composite_gate", operator: "or", gates: [icp, chit] }));
        state.replaceGate(icp, { ...icp, amount: 5n });
        expect(state.gateConfig.gate).toEqual({
            kind: "composite_gate",
            operator: "or",
            gates: [{ ...icp, amount: 5n }, chit],
        });
    });

    test("a lone gate changed in place stays a lone gate", () => {
        const state = new UpdateGroupState();
        state.initialise(group(icp));
        state.replaceGate(icp, { ...icp, amount: 5n });
        expect(state.gateConfig.gate).toEqual({ ...icp, amount: 5n });
    });

    test("the gates combine as they're set to, from two gates", () => {
        const state = new UpdateGroupState();
        state.initialise(group({ kind: "composite_gate", operator: "and", gates: [icp, chit] }));
        state.setOperator("or");
        expect(state.gateConfig.gate).toMatchObject({ operator: "or" });

        // one gate has nothing to combine
        const lone = new UpdateGroupState();
        lone.initialise(group(icp));
        lone.setOperator("or");
        expect(lone.gateConfig.gate).toEqual(icp);
    });
});
