import type { Level } from "./structure";

export type AccessGateConfig = {
    gate: AccessGate;
    expiry?: bigint;
};

export type AccessGateWithLevel = { level: Level } & AccessGate;

export type AccessGate = LeafGate | CompositeGate;

export type AccessGateConfig = {
    gate: AccessGate;
    expiry: bigint | undefined;
};

export type ActiveLeafGate = Exclude<LeafGate, NoGate>;

export type PreprocessedGate = CredentialGate | PaymentGate | UniquePersonGate;

export type LeafGate =
    | NoGate
    | NeuronGate
    | PaymentGate
    | DiamondGate
    | LifetimeDiamondGate
    | NftGate
    | CredentialGate
    | TokenBalanceGate
    | UniquePersonGate
    | LockedGate
    | ReferredByMemberGate;

export type ReferredByMemberGate = {
    kind: "referred_by_member_gate";
};

export type LockedGate = {
    kind: "locked_gate";
};

export type CompositeGate = {
    kind: "composite_gate";
    gates: LeafGate[];
    operator: "and" | "or";
};

export type NoGate = { kind: "no_gate" };

export type NftGate = { kind: "nft_gate" };

export type Credential = {
    credentialName: string;
    issuerCanisterId: string;
    issuerOrigin: string;
    credentialType: string;
    credentialArguments?: Record<string, string | number>;
};

export type CredentialGate = {
    kind: "credential_gate";
    credential: Credential;
};

export type VerifiedCredentialArgs = {
    userIIPrincipal: string;
    iiOrigin: string;
    credentialJwts: string[];
};

export type NeuronGate = {
    kind: "neuron_gate";
    governanceCanister: string;
    minStakeE8s?: number;
    minDissolveDelay?: number;
};

export type PaymentGate = {
    kind: "payment_gate";
    ledgerCanister: string;
    amount: bigint;
    fee: bigint;
};

export type TokenBalanceGate = {
    kind: "token_balance_gate";
    ledgerCanister: string;
    minBalance: bigint;
};

export function isLeafGate(gate: AccessGate): gate is LeafGate {
    return gate.kind !== "composite_gate";
}

export function shouldPreprocessGate(gate: AccessGate): gate is PreprocessedGate {
    return [
        "unique_person_gate",
        "credential_gate",
        "payment_gate",
        "lifetime_diamond_gate",
        "diamond_gate",
    ].includes(gate.kind);
}

export function isLocked(gate: AccessGate | undefined): boolean {
    if (gate === undefined) return false;
    if (isCompositeGate(gate)) {
        switch (gate.operator) {
            case "and":
                return gate.gates.some(isLockedGate);
            case "or":
                return gate.gates.every(isLockedGate);
        }
    } else {
        return isLockedGate(gate);
    }
}

function isLockedGate(gate: AccessGate): gate is LockedGate {
    return gate.kind === "locked_gate";
}

export function isCompositeGate(gate: AccessGate): gate is CompositeGate {
    return gate.kind === "composite_gate";
}

export function isNeuronGate(gate: AccessGate): gate is NeuronGate {
    return gate.kind === "neuron_gate";
}

export function isPaymentGate(gate: AccessGate): gate is PaymentGate {
    return gate.kind === "payment_gate";
}

export function isBalanceGate(gate: AccessGate): gate is TokenBalanceGate {
    return gate.kind === "token_balance_gate";
}

export function isCredentialGate(gate: AccessGate): gate is CredentialGate {
    return gate.kind === "credential_gate";
}

export function isUniquePersonGate(gate: AccessGate): gate is UniquePersonGate {
    return gate.kind === "unique_person_gate";
}

export function isLifetimeDiamondGate(gate: AccessGate): gate is LifetimeDiamondGate {
    return gate.kind === "lifetime_diamond_gate";
}

export function isDiamondGate(gate: AccessGate): gate is DiamondGate {
    return gate.kind === "diamond_gate";
}

export type DiamondGate = { kind: "diamond_gate" };

export type LifetimeDiamondGate = { kind: "lifetime_diamond_gate" };

export type UniquePersonGate = { kind: "unique_person_gate" };

export type AccessControlled = {
    gateConfig: AccessGateConfig;
    public: boolean;
    frozen: boolean;
    historyVisible: boolean;
};

export type VersionedRules = Rules & {
    version: number;
};

export type Rules = {
    text: string;
    enabled: boolean;
};

export type UpdatedRules = Rules & {
    newVersion: boolean;
};

export function defaultChatRules(level: Level): VersionedRules {
    let text = "";

    if (level !== "channel") {
        text = `- Do not impersonate others in a deceptive or misleading manner
- Do not intentionally share false or misleading information
- Keep messages relevant to the ${level === "community" ? "channel" : "group"}

If you break the rules you might be blocked and/or have your message(s) deleted.`;
    }

    return {
        text,
        enabled: false,
        version: 0,
    };
}

export type GateCheckSucceeded = { credentials: string[] };
