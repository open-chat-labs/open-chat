import type { OCError, OpenChat, Success, UserSummary } from "@client";
import { describe, expect, test, vi } from "vitest";
import {
    PendingProposals,
    isOwnProposal,
    parsePendingProposals,
    proposerName,
    unknownProposers,
    type PendingProposal,
} from "./pendingProposals.svelte";

type ProposalsClient = Pick<
    OpenChat,
    "protectedActions" | "confirmProtectedAction" | "cancelProtectedAction" | "getUser"
>;

const proposal = (id: number, by: string): PendingProposal => ({
    id,
    summary: `proposal ${id}`,
    proposed_by: by,
    proposed_at: 1,
    expires_at: 2,
});

const register = JSON.stringify({ pending: [proposal(1, "alice"), proposal(2, "bob")] });

function client(overrides: Partial<ProposalsClient> = {}): ProposalsClient {
    return {
        protectedActions: async () => register,
        confirmProtectedAction: async (): Promise<Success | OCError> => ({ kind: "success" }),
        cancelProtectedAction: async (): Promise<Success | OCError> => ({ kind: "success" }),
        getUser: async () => undefined,
        ...overrides,
    };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("parsePendingProposals", () => {
    test("the pending list, or none", () => {
        expect(parsePendingProposals(register).map((p) => p.id)).toEqual([1, 2]);
        expect(parsePendingProposals("{}")).toEqual([]);
        expect(parsePendingProposals("not json")).toEqual([]);
    });
});

describe("helpers", () => {
    test("isOwnProposal", () => {
        expect(isOwnProposal(proposal(1, "alice"), "alice")).toBe(true);
        expect(isOwnProposal(proposal(1, "alice"), "bob")).toBe(false);
    });

    test("unknownProposers lists each unknown proposer once", () => {
        const pending = [proposal(1, "alice"), proposal(2, "bob"), proposal(3, "bob")];
        expect(unknownProposers(pending, (id) => id === "alice")).toEqual(["bob"]);
    });

    test("proposerName", () => {
        expect(proposerName("abc", undefined)).toBe("abc");
        expect(proposerName("abc", { username: "alice" } as UserSummary)).toBe("@alice");
    });
});

describe("PendingProposals", () => {
    test("refresh loads the list and asks for proposers it doesn't know", async () => {
        const getUser = vi.fn(async (_userId: string) => undefined);
        const proposals = new PendingProposals(client({ getUser }));
        expect(proposals.loading).toBe(true);
        await proposals.refresh();
        expect(proposals.loading).toBe(false);
        expect(proposals.pending.map((p) => p.id)).toEqual([1, 2]);
        expect(getUser.mock.calls.map((c) => c[0])).toEqual(["alice", "bob"]);
    });

    test("refresh says so when the register can't be read", async () => {
        const proposals = new PendingProposals(client({ protectedActions: async () => undefined }));
        await proposals.refresh();
        expect(proposals.error?.key).toBe("Failed to load the pending proposals");

        const throwing = new PendingProposals(
            client({ protectedActions: () => Promise.reject(new Error("x")) }),
        );
        await throwing.refresh();
        expect(throwing.error?.key).toBe("Failed to load the pending proposals");
        expect(throwing.loading).toBe(false);
    });

    test("confirm is busy while it runs, then reloads the list", async () => {
        const protectedActions = vi.fn(async () => register);
        const proposals = new PendingProposals(client({ protectedActions }));
        const confirming = proposals.confirm(1);
        expect(proposals.busy.has(1)).toBe(true);
        const outcome = await confirming;
        expect(proposals.busy.has(1)).toBe(false);
        expect(outcome).toEqual({
            kind: "success",
            message: expect.objectContaining({ key: "Proposal confirmed and applied" }),
        });
        await settle();
        expect(protectedActions).toHaveBeenCalledTimes(1);
    });

    test("a refused confirmation says why, or guesses when the canister doesn't", async () => {
        const withReason = new PendingProposals(
            client({
                confirmProtectedAction: async () => ({
                    kind: "error",
                    code: 1,
                    message: "A legal hold now stands",
                }),
            }),
        );
        const outcome = await withReason.confirm(1);
        expect(outcome.kind).toBe("failed");
        expect(outcome.message.key).toBe("A legal hold now stands");

        const without = new PendingProposals(
            client({
                confirmProtectedAction: async () => ({
                    kind: "error",
                    code: -1,
                    message: undefined,
                }),
            }),
        );
        expect((await without.confirm(1)).message.key).toBe(
            "Failed to confirm the proposal - it may have been superseded, cancelled or expired",
        );
    });

    test("reject", async () => {
        const cancel = vi.fn(
            async (): Promise<Success | OCError> => ({
                kind: "error",
                code: 2,
                message: undefined,
            }),
        );
        const proposals = new PendingProposals(client({ cancelProtectedAction: cancel }));
        const outcome = await proposals.reject(7);
        expect(cancel).toHaveBeenCalledWith(7n);
        expect(outcome.message.key).toBe("Failed to reject the proposal");

        const ok = new PendingProposals(client());
        expect((await ok.reject(7)).message.key).toBe("Proposal rejected");
    });
});
