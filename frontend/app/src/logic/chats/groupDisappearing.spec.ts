import type { CandidateGroupChat, MultiUserChat, OpenChat, UpdateGroupOutcome } from "@client";
import { describe, expect, test, vi } from "vitest";
import { setGroupDisappearing } from "./groupDisappearing";

const WEEK = 7 * 24 * 60 * 60 * 1000;

const chat = {
    kind: "group_chat",
    id: { kind: "group_chat", groupId: "g" },
    name: "Book Club",
    description: "",
    historyVisible: true,
    public: true,
    frozen: false,
    permissions: {},
    blobReference: undefined,
    blobUrl: undefined,
    blobData: undefined,
    gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
    level: "group",
    membership: { role: 4 },
    eventsTTL: undefined,
    messagesVisibleToNonMembers: false,
    verified: false,
} as never as MultiUserChat;

function client(outcome: UpdateGroupOutcome) {
    const updateGroup = vi.fn(
        async (_original: CandidateGroupChat, _candidate: CandidateGroupChat) => outcome,
    );
    return { client: { updateGroup } as never as Pick<OpenChat, "updateGroup">, updateGroup };
}

describe("a group's disappearing messages", () => {
    test("switching them on sends the group as it is with only the TTL changed", async () => {
        const { client: c, updateGroup } = client({ kind: "success" });
        await setGroupDisappearing(c, chat, { on: true, afterMs: WEEK });
        const [original, candidate] = updateGroup.mock.calls[0];
        expect(original.eventsTTL).toBeUndefined();
        expect(candidate).toEqual({ ...original, eventsTTL: BigInt(WEEK) });
    });

    test("switching them off clears the TTL", async () => {
        const { client: c, updateGroup } = client({ kind: "success" });
        await setGroupDisappearing(
            c,
            { ...chat, eventsTTL: BigInt(WEEK) },
            {
                on: false,
                afterMs: WEEK,
            },
        );
        const [original, candidate] = updateGroup.mock.calls[0];
        expect(original.eventsTTL).toBe(BigInt(WEEK));
        expect(candidate.eventsTTL).toBeUndefined();
    });

    test("a refusal rejects, for the view to roll back", async () => {
        const { client: c } = client({
            kind: "failed",
            message: { kind: "resource_key" } as never,
        });
        await expect(setGroupDisappearing(c, chat, { on: true, afterMs: WEEK })).rejects.toThrow();
    });
});
