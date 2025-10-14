import {
    isCompositeGate,
    isLeafGate,
    ROLE_MEMBER,
    type AccessControlled,
    type AccessGate,
    type AccessGateConfig,
    type CandidateMember,
    type ChitEarnedGate,
    type HasLevel,
    type LeafGate,
    type NeuronGate,
    type PaymentGate,
    type TokenBalanceGate,
    type UserOrUserGroup,
    type UserSummary,
} from "openchat-client";

function gatesByKind(config: AccessGateConfig, kind: AccessGate["kind"]): AccessGate[] {
    if (isLeafGate(config.gate)) {
        if (config.gate.kind === kind) {
            return [config.gate];
        }
    }
    if (isCompositeGate(config.gate)) {
        return config.gate.gates.filter((g) => g.kind === kind);
    }
    return [];
}

type Entity = AccessControlled & HasLevel;

export abstract class UpdateGroupOrCommunityState {
    abstract get candidate(): Entity;
    abstract get original(): Entity | undefined;
    #confirming = $state(false);
    #busy = $state(false);
    #showingVerificationWarning = $state(false);
    #candidateMembers = $state<CandidateMember[]>([]);
    #candidateUsers = $derived(this.#candidateMembers.map((m) => m.user));
    #accessGates = $derived.by<LeafGate[]>(() => {
        if (this.candidate === undefined) return [];
        if (this.candidate.gateConfig.gate.kind === "no_gate") return [];
        if (isLeafGate(this.candidate.gateConfig.gate)) return [this.candidate.gateConfig.gate];
        if (isCompositeGate(this.candidate.gateConfig.gate))
            return this.candidate.gateConfig.gate.gates;
        return [];
    });
    #gateConfig = $derived.by<AccessGateConfig>(
        () => this.candidate.gateConfig ?? { expiry: undefined, gate: { kind: "no_gate" } },
    );
    #neuronGates = $derived.by<NeuronGate[]>(() => {
        return gatesByKind(this.gateConfig, "neuron_gate") as NeuronGate[];
    });
    #paymentGates = $derived.by<PaymentGate[]>(() => {
        return gatesByKind(this.gateConfig, "payment_gate") as PaymentGate[];
    });
    #tokenBalanceGates = $derived.by<TokenBalanceGate[]>(() => {
        return gatesByKind(this.gateConfig, "token_balance_gate") as TokenBalanceGate[];
    });

    protected reset() {
        this.#busy = false;
        this.#confirming = false;
        this.#candidateMembers = [];
        this.#showingVerificationWarning = false;
    }

    get showingVerificationWarning() {
        return this.#showingVerificationWarning;
    }

    set showingVerificationWarning(val: boolean) {
        this.#showingVerificationWarning = val;
    }

    get busy() {
        return this.#busy;
    }

    set busy(val: boolean) {
        this.#busy = val;
    }

    get confirming() {
        return this.#confirming;
    }

    set confirming(val: boolean) {
        this.#confirming = val;
    }

    get accessGates() {
        return this.#accessGates;
    }
    get gateConfig() {
        return this.#gateConfig;
    }
    get neuronGates() {
        return this.#neuronGates;
    }

    get paymentGates() {
        return this.#paymentGates;
    }

    get tokenBalanceGates() {
        return this.#tokenBalanceGates;
    }

    get candidateMembers() {
        return this.#candidateMembers;
    }

    get candidateUsers() {
        return this.#candidateUsers;
    }

    deleteMember(user: UserOrUserGroup): void {
        if (user.kind !== "user") return;
        this.#candidateMembers = this.#candidateMembers.filter(
            (m) => m.user.userId !== user.userId,
        );
    }

    addMember(user: UserSummary): void {
        const u = this.#candidateMembers.find((m) => m.user.userId === user.userId);
        if (u === undefined) {
            this.#candidateMembers.push({ role: ROLE_MEMBER, user });
        }
    }

    isGateActive(gate: AccessGate) {
        if (isLeafGate(this.#gateConfig.gate)) {
            return gate.kind === this.#gateConfig.gate.kind;
        }
        if (isCompositeGate(this.#gateConfig.gate)) {
            return this.#gateConfig.gate.gates.some((g) => g.kind === gate.kind);
        }
        return false;
    }

    addLeaf(newGate: LeafGate) {
        if (isCompositeGate(this.#gateConfig.gate)) {
            this.#gateConfig.gate.gates.push(newGate);
        } else {
            if (this.#gateConfig.gate.kind === "no_gate") {
                this.#gateConfig.gate = newGate;
            } else {
                const oldGate = { ...this.#gateConfig.gate };
                this.#gateConfig.gate = {
                    kind: "composite_gate",
                    gates: [oldGate, newGate],
                    operator: "and",
                };
            }
        }
    }

    deleteGate(gate: LeafGate) {
        if (isCompositeGate(this.#gateConfig.gate)) {
            this.#gateConfig.gate.gates = this.#gateConfig.gate.gates.filter(
                (g) => !this.gatesMatch(g, gate),
            );
            if (this.#gateConfig.gate.gates.length === 1) {
                this.#gateConfig.gate = this.#gateConfig.gate.gates[0];
            }
        } else {
            this.#gateConfig.gate = { kind: "no_gate" };
        }
    }

    #findMatchBy(fn: (g: LeafGate) => boolean) {
        if (isCompositeGate(this.#gateConfig.gate)) {
            return this.#gateConfig.gate.gates.find(fn);
        }

        if (isLeafGate(this.#gateConfig.gate) && fn(this.#gateConfig.gate)) {
            return this.#gateConfig.gate;
        }
    }

    findMatchByKind(kind: LeafGate["kind"]): LeafGate | undefined {
        return this.#findMatchBy((g) => g.kind === kind);
    }

    findMatch(gate: LeafGate): LeafGate | undefined {
        return this.#findMatchBy((g) => this.gatesMatch(g, gate));
    }

    gatesMatch(a: LeafGate, b: LeafGate): boolean {
        if (a.kind === "neuron_gate" && b.kind === "neuron_gate") {
            return a.governanceCanister === b.governanceCanister;
        }
        if (a.kind === "payment_gate" && b.kind === "payment_gate") {
            return a.ledgerCanister === b.ledgerCanister;
        }
        if (a.kind === "token_balance_gate" && b.kind === "token_balance_gate") {
            return a.ledgerCanister === b.ledgerCanister;
        }
        return a.kind === b.kind;
    }

    defaultChitGate(): ChitEarnedGate {
        return {
            kind: "chit_earned_gate",
            minEarned: 0,
        };
    }

    defaultTokenBalanceGate(): TokenBalanceGate {
        return {
            kind: "token_balance_gate",
            ledgerCanister: "",
            minBalance: 0n,
        };
    }

    defaultNeuronGate(): NeuronGate {
        return {
            kind: "neuron_gate",
            governanceCanister: "",
        };
    }

    defaultPaymentGate(): PaymentGate {
        return {
            kind: "payment_gate",
            ledgerCanister: "",
            amount: 0n,
            fee: 0n,
        };
    }

    toggleGate(gate: AccessGate, active: boolean) {
        if (isLeafGate(gate)) {
            if (active) {
                this.deleteGate(gate);
            } else {
                this.addLeaf(gate);
            }
        }
    }

    toggleOperator() {
        if (isCompositeGate(this.#gateConfig.gate)) {
            switch (this.#gateConfig.gate.operator) {
                case "and":
                    this.#gateConfig.gate.operator = "or";
                    break;
                case "or":
                    this.#gateConfig.gate.operator = "and";
                    break;
            }
        }
    }
}
