import {
    i18nKey,
    type EnhancedAccessGate,
    type GateCheckSucceeded,
    type JoinOutcome,
    type MultiUserChat,
    type OpenChat,
    type RulesToAccept,
} from "@client";
import { describe, expect, test, vi } from "vitest";
import { JoinFlow, joinStep, rulesToAcceptText } from "./joinFlow.svelte";

type JoinClient = Pick<OpenChat, "joinGroup" | "joinCommunity">;

// what the flows here read as the rules: none, unless a test says
const noRules = async () => undefined;

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
    const join = new JoinFlow<MultiUserChat>(
        (c, target, check) => c.joinGroup(target, check),
        noRules,
    );
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
        const join = new JoinFlow<MultiUserChat>(
            (c, target, check) => c.joinGroup(target, check),
            noRules,
        );

        const joined = join.join(client, chat);
        expect(join.joining).toBe(chat);
        answer({ kind: "success" });
        await joined;
        expect(join.joining).toBeUndefined();
    });

    // a second join started while the first is on its way stays busy until it settles itself
    test("one join settling leaves another still on its way joining", async () => {
        const answers: ((outcome: JoinOutcome) => void)[] = [];
        const request = vi.fn(() => new Promise<JoinOutcome>((resolve) => answers.push(resolve)));
        const client: JoinClient = { joinGroup: request, joinCommunity: request };
        const join = new JoinFlow<MultiUserChat>(
            (c, target, check) => c.joinGroup(target, check),
            noRules,
        );
        const other = { ...chat, name: "other" };

        const first = join.join(client, chat);
        const second = join.join(client, other);
        answers[0]({ kind: "success" });
        await first;
        expect(join.joining).toBe(other);

        answers[1]({ kind: "success" });
        await second;
        expect(join.joining).toBeUndefined();
    });

    // the web's gate dialog stays open while the join doesn't go through, and sends it again
    test("submitting the gates keeps the join while it doesn't go through", async () => {
        const { join, client, request } = flow(
            { kind: "needs_gate_evaluation", gates: [gate] },
            new Error("PIN prompt dismissed"),
            { kind: "failed", message: i18nKey("joinGroupFailed") },
            { kind: "success" },
        );
        await join.join(client, chat);

        expect(await join.submitGates(client, gateCheck)).toEqual({ kind: "cancelled" });
        expect(join.evaluating).toBe(chat);
        expect(await join.submitGates(client, gateCheck)).toMatchObject({ kind: "failed" });
        expect(join.evaluating).toBe(chat);

        expect(await join.submitGates(client, gateCheck)).toEqual({ kind: "joined" });
        expect(request).toHaveBeenLastCalledWith(chat, gateCheck);
        expect(join.evaluating).toBeUndefined();
        expect(await join.submitGates(client, gateCheck)).toEqual({ kind: "not_sent" });
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

describe("the text of the rules to agree to", () => {
    test("a channel's own, then its community's", () => {
        expect(rulesToAcceptText({ chat: "channel", community: undefined })).toBe("channel");
        expect(rulesToAcceptText({ chat: undefined, community: "community" })).toBe("community");
        expect(rulesToAcceptText({ chat: "channel", community: "community" })).toBe(
            "channel\n\ncommunity",
        );
    });
});

describe("agreeing to the rules before joining", () => {
    const agreed: RulesToAccept = { chat: "be nice", community: undefined };

    function rulesFlow(rules: RulesToAccept | undefined | Error, ...outcomes: JoinOutcome[]) {
        const request = vi.fn(async () => outcomes.shift() ?? { kind: "success" as const });
        const readRules = vi.fn(async () => {
            if (rules instanceof Error) throw rules;
            return rules;
        });
        const client = {
            joinGroup: request,
            joinCommunity: request,
            rulesToAcceptBeforeJoining: readRules,
        };
        const join = new JoinFlow<MultiUserChat>(
            (c, target, check, agreedRules) => c.joinGroup(target, check, agreedRules),
            (c, target) => c.rulesToAcceptBeforeJoining(target),
        );
        return { join, client, request, readRules };
    }

    test("rules to agree to come first, and nothing is joined yet", async () => {
        const { join, client, request } = rulesFlow(agreed);

        expect(await join.begin(client, chat)).toEqual({ kind: "agree_to_rules", rules: agreed });
        expect(request).not.toHaveBeenCalled();
        expect(join.joining).toBeUndefined();
    });

    test("with no rules to agree to, it joins straight away", async () => {
        const { join, client, request } = rulesFlow(undefined);

        expect(await join.begin(client, chat)).toEqual({ kind: "joined" });
        expect(request).toHaveBeenCalledWith(chat, undefined, undefined);
    });

    test("rules that couldn't be read don't stop the join", async () => {
        const { join, client, request } = rulesFlow(new Error("offline"));

        expect(await join.begin(client, chat)).toEqual({ kind: "joined" });
        expect(request).toHaveBeenCalledOnce();
    });

    test("is joining while the rules are read", async () => {
        const { join, client, readRules } = rulesFlow(undefined);
        let answer: (rules: RulesToAccept | undefined) => void = () => {};
        readRules.mockImplementation(() => new Promise((resolve) => (answer = resolve)));

        const begun = join.begin(client, chat);
        expect(join.joining).toBe(chat);
        answer(agreed);
        await begun;
        expect(join.joining).toBeUndefined();
    });

    test("the rules agreed to go with the join", async () => {
        const { join, client, request } = rulesFlow(agreed);

        expect(await join.join(client, chat, agreed)).toEqual({ kind: "joined" });
        expect(request).toHaveBeenCalledWith(chat, undefined, agreed);
    });

    test("the rules agreed to go with the join through its gates", async () => {
        const { join, client, request } = rulesFlow(
            agreed,
            { kind: "needs_gate_evaluation", gates: [gate] },
            { kind: "failed", message: i18nKey("joinGroupFailed") },
            { kind: "success" },
        );

        expect(await join.join(client, chat, agreed)).toMatchObject({ kind: "evaluate_gates" });
        expect(await join.submitGates(client, gateCheck)).toMatchObject({ kind: "failed" });
        expect(request).toHaveBeenLastCalledWith(chat, gateCheck, agreed);
        expect(await join.submitGates(client, gateCheck)).toEqual({ kind: "joined" });
        expect(request).toHaveBeenLastCalledWith(chat, gateCheck, agreed);
    });

    test("continuing after the gates keeps the rules agreed to", async () => {
        const { join, client, request } = rulesFlow(agreed, {
            kind: "needs_gate_evaluation",
            gates: [gate],
        });

        await join.join(client, chat, agreed);
        expect(await join.continueJoin(client, gateCheck)).toEqual({ kind: "joined" });
        expect(request).toHaveBeenLastCalledWith(chat, gateCheck, agreed);
    });

    test("a closed evaluation drops the rules agreed to with the join", async () => {
        const { join, client, request } = rulesFlow(
            agreed,
            { kind: "needs_gate_evaluation", gates: [gate] },
            { kind: "success" },
        );

        await join.join(client, chat, agreed);
        join.reset();
        await join.join(client, chat);
        expect(request).toHaveBeenLastCalledWith(chat, undefined, undefined);
    });
});
