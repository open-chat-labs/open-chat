import type { ActiveLeafGate } from "@client";

// The entry a gate's entries screens are on (a payment, minimum balance or neuron gate's: a token
// or nervous system with its value): a new one or one being changed, picked on one screen, its
// value set on the next.

export class GateEntryDraft {
    /** The entry being changed, as it is in the gates; none for a new one. */
    editing = $state.raw<ActiveLeafGate | undefined>(undefined);
    /** Its token's ledger or nervous system's governance canister, once picked. */
    asset = $state<string | undefined>(undefined);

    /** Adding an entry: nothing picked yet. */
    startNew(): void {
        this.editing = undefined;
        this.asset = undefined;
    }

    /** Changing the entry `gate`. */
    startEdit(gate: ActiveLeafGate): void {
        this.editing = gate;
        this.asset = assetOf(gate);
    }
}

/** An entry's token (ledger) or nervous system (governance canister); none for other gates. */
export function assetOf(gate: ActiveLeafGate): string | undefined {
    switch (gate.kind) {
        case "payment_gate":
        case "token_balance_gate":
            return gate.ledgerCanister;
        case "neuron_gate":
            return gate.governanceCanister;
        default:
            return undefined;
    }
}
