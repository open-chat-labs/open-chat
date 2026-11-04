import {
    i18nKey,
    type EnhancedAccessGate,
    type GateCheckSucceeded,
    type JoinOutcome,
    type MultiUserChat,
    type OpenChat,
} from "@client";
import { describe, expect, test, vi } from "vitest";
import { JoinFlow, joinStep } from "./joinFlow.svelte";

type JoinClient = Pick<OpenChat, "joinGroup" | "joinCommunity">;

const gate: EnhancedAccessGate = {
    kind: "diamond_gate",
    level: "group",
    collectionName: "g",
    expiry: undefined,
};
const gateCheck: GateCheckSucceeded = {
    credentials: [],
    paymentApprovals: new Map(),
    compositeGateIndex: undefined,
};
// the flow only hands the chat to the client
const chat = { id: { kind: "group_chat" as const, groupId: "g" }, name: "g" } as MultiUserChat;

function flow(...outcomes: (JoinOutcome | Error)[]) {
    const request = vi.fn(async () => {
        const next = outcomes.shift();
        if (next === undefined || next instanceof Error) throw next ?? new Error("no outcome");
        return next;
    });
    const client: JoinClient = { joinGroup: request, joinCommunity: request };
    const join = new JoinFlow<MultiUserChat>((c, target, check) => c.joinGroup(target, check));
    return { join, client, request };
}

describe("a join's next step", () => {
    // 8b invariant 5: every non-success join outcome reaches the user as a message or a dialog
    test("every non-success join outcome reaches the user as a message or a dialog", () => {
        expect(joinStep({ kind: "success" })).toEqual({ kind: "joined" });
        expect(joinStep({ kind: "skipped" })).toEqual({ kind: "not_sent" });
        expect(joinStep({ kind: "needs_gate_evaluation", gates: [gate] })).toEqual({
            kind: "evaluate_gates",
            gates: [gate],
        });
        expect(joinStep({ kind: "gate_check_failed", gates: [gate] })).toEqual({
            kind: "gate_check_failed",
            gates: [gate],
        });
        const message = i18nKey("joinGroupFailed");
        expect(joinStep({ kind: "failed", message })).toEqual({ kind: "failed", message });
    });
});

describe("the join flow", () => {
    test("holds the join while its gates are evaluated, and carries it on once with what they gave", async () => {
        const { join, client, request } = flow(
            { kind: "needs_gate_evaluation", gates: [gate] },
            { kind: "success" },
        );

        expect(await join.join(client, chat)).toMatchObject({ kind: "evaluate_gates" });
        expect(join.evaluating).toBe(chat);
        expect(join.gatesToEvaluate).toEqual([gate]);

        expect(await join.continueJoin(client, gateCheck)).toEqual({ kind: "joined" });
        expect(request).toHaveBeenLastCalledWith(chat, gateCheck);
        expect(join.evaluating).toBeUndefined();
        expect(join.gatesToEvaluate).toEqual([]);

        // nothing left to carry on with
        expect(await join.continueJoin(client, gateCheck)).toEqual({ kind: "not_sent" });
        expect(request).toHaveBeenCalledTimes(2);
    });

    test("a closed evaluation drops the join", async () => {
        const { join, client, request } = flow({ kind: "needs_gate_evaluation", gates: [gate] });
        await join.join(client, chat);

        join.reset();

        expect(await join.continueJoin(client, gateCheck)).toEqual({ kind: "not_sent" });
        expect(request).toHaveBeenCalledOnce();
    });

    // the Join button keeps its spinner through the PIN, the approval and the join
    test("is joining until the client answers", async () => {
        let answer: (outcome: JoinOutcome) => void = () => {};
        const request = vi.fn(() => new Promise<JoinOutcome>((resolve) => (answer = resolve)));
        const client: JoinClient = { joinGroup: request, joinCommunity: request };
        const join = new JoinFlow<MultiUserChat>((c, target, check) => c.joinGroup(target, check));

        const joined = join.join(client, chat);
        expect(join.joining).toBe(chat);
        answer({ kind: "success" });
        await joined;
        expect(join.joining).toBeUndefined();
    });

    test("a dismissed PIN prompt is a cancelled join, with nothing to say", async () => {
        const { join, client } = flow(new Error("PIN prompt dismissed"));

        expect(await join.join(client, chat)).toEqual({ kind: "cancelled" });
        expect(join.joining).toBeUndefined();
    });

    test("keeps the gates the backend found unmet until they're closed", async () => {
        const { join, client } = flow({ kind: "gate_check_failed", gates: [gate] });

        await join.join(client, chat);
        expect(join.gateCheckFailed).toEqual([gate]);
        join.reset();
        expect(join.gateCheckFailed).toEqual([]);
    });
});
