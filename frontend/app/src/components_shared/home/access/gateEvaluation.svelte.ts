import {
    cryptoBalanceStore,
    currentUserStore,
    isCompositeGate,
    isUniquePersonGate,
    type EnhancedAccessGate,
    type EnhancedLeafGate,
    type GateCheckSucceeded,
    type OpenChat,
} from "@client";
import { createSubscriber, SvelteMap, SvelteSet } from "svelte/reactivity";

export type EvaluatedLeafGate = EnhancedLeafGate & {
    satisfied: boolean;
    // the leaf's index in its composite gate, which is what the backend expects as compositeGateIndex
    originalIndex: number;
};

/**
 * Walks the user through the gates they must meet before a join, one gate per level (community, then channel),
 * and collects the credentials and payment approvals to send with the join. Both trees render it.
 */
export class GateEvaluation {
    #client: Pick<OpenChat, "doesUserMeetAccessGate">;
    #gates: EnhancedAccessGate[];
    #index = $state(0);
    // originalIndex of the current gate's leaves the user has satisfied in this evaluation
    #done = new SvelteSet<number>();
    #credentials: string[] = [];
    #paymentApprovals = new SvelteMap<string, { amount: bigint; approvalFee: bigint }>();
    #compositeGateIndex: number | undefined;
    // Re-evaluates the leaves when a balance or the user changes, e.g. a top-up or a Diamond
    // purchase part way through. Both stores emit on subscribe, which is skipped.
    #subscribe = createSubscriber((update) => {
        const unsubs = [cryptoBalanceStore, currentUserStore].map((store) => {
            let first = true;
            return store.subscribe(() => (first ? (first = false) : update()));
        });
        return () => unsubs.forEach((unsub) => unsub());
    });

    constructor(client: Pick<OpenChat, "doesUserMeetAccessGate">, gates: EnhancedAccessGate[]) {
        this.#client = client;
        this.#gates = gates;
        this.#index = this.#nextUnmet(0);
    }

    /** The gate being evaluated, or undefined once every gate is done */
    get gate(): EnhancedAccessGate | undefined {
        return this.#gates[this.#index];
    }

    #leaves = $derived.by(() => {
        const gate = this.gate;
        if (gate === undefined) return [];
        // Unique person (DecideAI) verification is suspended, so hide it. originalIndex is
        // taken before filtering so compositeGateIndex still maps to the real gate.
        const leaves = isCompositeGate(gate)
            ? gate.gates.map((g, i) => ({
                  ...g,
                  level: gate.level,
                  collectionName: gate.collectionName,
                  expiry: gate.expiry,
                  originalIndex: i,
              }))
            : [{ ...gate, originalIndex: 0 }];
        return leaves.filter((g) => !isUniquePersonGate(g));
    });

    /** The current gate's leaves, satisfied ones first */
    get leaves(): EvaluatedLeafGate[] {
        return this.#leaves
            .map((g) => ({ ...g, satisfied: this.#satisfied(g) }))
            .toSorted((a, b) => Number(b.satisfied) - Number(a.satisfied));
    }

    get satisfiedCount(): number {
        return this.leaves.filter((g) => g.satisfied).length;
    }

    get complete(): boolean {
        const gate = this.gate;
        if (gate === undefined) return false;
        return isCompositeGate(gate) && gate.operator === "or"
            ? this.satisfiedCount >= 1
            : this.satisfiedCount === this.leaves.length;
    }

    /**
     * Whether the user still has to satisfy this leaf. Once the leaf, or the gate it belongs to, is satisfied nothing
     * more is collected for it, so the user never pays twice for one gate or for a second branch of an "or" gate.
     */
    needs(leaf: EvaluatedLeafGate): boolean {
        return !this.complete && !this.#done.has(leaf.originalIndex);
    }

    balanceAfterCurrentCommitments(ledger: string, balance: bigint): bigint {
        return balance - (this.#paymentApprovals.get(ledger)?.amount ?? 0n);
    }

    approvePayment(
        leaf: EvaluatedLeafGate,
        { ledger, amount, approvalFee }: { ledger: string; amount: bigint; approvalFee: bigint },
    ) {
        if (!this.needs(leaf)) return;
        // A second payment on the same ledger adds to the approval, which only carries one fee
        const existing = this.#paymentApprovals.get(ledger);
        this.#paymentApprovals.set(ledger, {
            amount: (existing?.amount ?? 0n) + amount,
            approvalFee: existing?.approvalFee ?? approvalFee,
        });
        this.#done.add(leaf.originalIndex);
    }

    addCredential(leaf: EvaluatedLeafGate, credential: string) {
        if (!this.needs(leaf)) return;
        this.#credentials.push(credential);
        this.#done.add(leaf.originalIndex);
    }

    /** The user confirms a gate only the backend can check, e.g. holding a neuron */
    confirm(leaf: EvaluatedLeafGate) {
        if (!this.needs(leaf)) return;
        this.#done.add(leaf.originalIndex);
    }

    /**
     * Moves on from the current gate once it is complete. Returns what to send with the join after the last gate,
     * otherwise undefined.
     */
    next(): GateCheckSucceeded | undefined {
        const gate = this.gate;
        if (gate === undefined || !this.complete) return undefined;
        if (isCompositeGate(gate) && gate.operator === "or") {
            this.#compositeGateIndex = this.#leaves.find((g) => this.#satisfied(g))?.originalIndex;
        }
        this.#done.clear();
        this.#index = this.#nextUnmet(this.#index + 1);
        if (this.gate !== undefined) return undefined;
        return {
            credentials: [...this.#credentials],
            paymentApprovals: new Map(this.#paymentApprovals),
            compositeGateIndex: this.#compositeGateIndex,
        };
    }

    #nextUnmet(from: number): number {
        let i = from;
        while (i < this.#gates.length && this.#client.doesUserMeetAccessGate(this.#gates[i])) i++;
        return i;
    }

    #satisfied(leaf: EnhancedLeafGate & { originalIndex: number }): boolean {
        if (this.#done.has(leaf.originalIndex)) return true;
        this.#subscribe();
        if (leaf.kind === "token_balance_gate") {
            const balance = cryptoBalanceStore.value.get(leaf.ledgerCanister) ?? 0n;
            return (
                this.balanceAfterCurrentCommitments(leaf.ledgerCanister, balance) >= leaf.minBalance
            );
        }
        return this.#client.doesUserMeetAccessGate(leaf);
    }
}
