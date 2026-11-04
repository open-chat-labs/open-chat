import {
    chatIdentifiersEqual,
    type CommunitySummary,
    type EnhancedAccessGate,
    type GateCheckSucceeded,
    type JoinCommunity,
    type JoinGroup,
    type JoinOutcome,
    type MultiUserChat,
    type OpenChat,
    type ResourceKey,
} from "@client";

// Joining a group, channel or community from its preview, shared by every tree (it was
// utils/preview.svelte.ts). The client does the join (`joinGroup`, `joinCommunity`); this keeps what
// the views show while it happens (the Join button's spinner, the gates to evaluate, the gates that
// weren't met) and says what the view should do next as a `JoinStep`, which each tree renders its
// own way (an evaluator, a toast, a dialog).

/** What to join: a group or channel, or a whole community. */
export type JoinTarget =
    | { kind: "group"; chat: MultiUserChat }
    | { kind: "community"; community: CommunitySummary };

/** What a join asks of the view next. */
export type JoinStep =
    | { kind: "joined" }
    // nothing was sent: a guest's join (recorded for after sign-in, which is opened), or a member's
    | { kind: "not_sent" }
    // there are gates the user must meet first: show them, then `continueJoin` with what they gave
    | { kind: "evaluate_gates"; gates: EnhancedAccessGate[] }
    // the backend found a gate the user doesn't meet
    | { kind: "gate_check_failed"; gates: EnhancedAccessGate[] }
    | { kind: "failed"; message: ResourceKey }
    // the user dismissed the PIN prompt for a payment: nothing joined, nothing to say
    | { kind: "cancelled" };

/** What the view does with a join's outcome. Every outcome but success says something. */
export function joinStep(outcome: JoinOutcome): JoinStep {
    switch (outcome.kind) {
        case "success":
            return { kind: "joined" };
        case "skipped":
            return { kind: "not_sent" };
        case "needs_gate_evaluation":
            return { kind: "evaluate_gates", gates: outcome.gates };
        case "gate_check_failed":
            return { kind: "gate_check_failed", gates: outcome.gates };
        case "failed":
            return { kind: "failed", message: outcome.message };
        default:
            return outcome satisfies never;
    }
}

type JoinClient = Pick<OpenChat, "joinGroup" | "joinCommunity">;

/**
 * One kind of join (groups and channels, or communities). `joining` is the one on its way to the
 * backend (through the PIN prompt and the payment approval too); `evaluating` the one whose gates
 * are being evaluated, which `continueJoin` carries on with and `reset` drops.
 */
export class JoinFlow<T> {
    #request: (
        client: JoinClient,
        target: T,
        gateCheck?: GateCheckSucceeded,
    ) => Promise<JoinOutcome>;
    #joining = $state.raw<T | undefined>();
    #evaluating = $state.raw<T | undefined>();
    #gatesToEvaluate = $state.raw<EnhancedAccessGate[]>([]);
    #gateCheckFailed = $state.raw<EnhancedAccessGate[]>([]);

    constructor(
        request: (
            client: JoinClient,
            target: T,
            gateCheck?: GateCheckSucceeded,
        ) => Promise<JoinOutcome>,
    ) {
        this.#request = request;
    }

    get joining(): T | undefined {
        return this.#joining;
    }

    get evaluating(): T | undefined {
        return this.#evaluating;
    }

    get gatesToEvaluate(): EnhancedAccessGate[] {
        return this.#gatesToEvaluate;
    }

    get gateCheckFailed(): EnhancedAccessGate[] {
        return this.#gateCheckFailed;
    }

    join(client: JoinClient, target: T): Promise<JoinStep> {
        this.reset();
        return this.#send(client, target);
    }

    /** Carries on with the join whose gates were evaluated; nothing if it was dropped meanwhile. */
    async continueJoin(client: JoinClient, gateCheck: GateCheckSucceeded): Promise<JoinStep> {
        const target = this.#evaluating;
        if (target === undefined) return { kind: "not_sent" };
        this.reset();
        return this.#send(client, target, gateCheck);
    }

    /** The gates' evaluation, or the gate check failure, was closed. */
    reset(): void {
        this.#evaluating = undefined;
        this.#gatesToEvaluate = [];
        this.#gateCheckFailed = [];
    }

    async #send(client: JoinClient, target: T, gateCheck?: GateCheckSucceeded): Promise<JoinStep> {
        this.#joining = target;
        let step: JoinStep;
        try {
            step = joinStep(await this.#request(client, target, gateCheck));
        } catch {
            // the client rejects only when the PIN prompt for a payment is dismissed
            step = { kind: "cancelled" };
        } finally {
            this.#joining = undefined;
        }
        if (step.kind === "evaluate_gates") {
            this.#evaluating = target;
            this.#gatesToEvaluate = step.gates;
        } else if (step.kind === "gate_check_failed") {
            this.#gateCheckFailed = step.gates;
        }
        return step;
    }
}

/** Joining groups and channels. */
export const groupJoin = new JoinFlow<MultiUserChat>((client, chat, gateCheck) =>
    client.joinGroup(chat, gateCheck),
);

/** Joining communities. */
export const communityJoin = new JoinFlow<CommunitySummary>((client, community, gateCheck) =>
    client.joinCommunity(community, gateCheck),
);

/** Starts joining a group, channel or community. */
export function startJoin(client: JoinClient, target: JoinTarget): Promise<JoinStep> {
    return target.kind === "group"
        ? groupJoin.join(client, target.chat)
        : communityJoin.join(client, target.community);
}

/** Carries on with a join once its gates were evaluated. */
export function continueJoin(
    client: JoinClient,
    target: JoinTarget,
    gateCheck: GateCheckSucceeded,
): Promise<JoinStep> {
    return target.kind === "group"
        ? groupJoin.continueJoin(client, gateCheck)
        : communityJoin.continueJoin(client, gateCheck);
}

/** Drops a join whose gates were being evaluated (the evaluator was closed). */
export function dropJoin(target: JoinTarget): void {
    if (target.kind === "group") groupJoin.reset();
    else communityJoin.reset();
}

/** Whether this target's join is on its way. */
export function isJoining(target: JoinTarget): boolean {
    if (target.kind === "group") {
        const joining = groupJoin.joining;
        return joining !== undefined && chatIdentifiersEqual(joining.id, target.chat.id);
    }
    return communityJoin.joining?.id.communityId === target.community.id.communityId;
}

/** The name of what's being joined. */
export function joinTargetName(target: JoinTarget): string {
    return target.kind === "group" ? target.chat.name : target.community.name;
}

/** A guest's join, recorded before sign-in (`client.takePostLoginJoin`), as a target. */
export function postLoginTarget(join: JoinGroup | JoinCommunity): JoinTarget {
    return join.kind === "join_group"
        ? { kind: "group", chat: join.group }
        : { kind: "community", community: join.community };
}
