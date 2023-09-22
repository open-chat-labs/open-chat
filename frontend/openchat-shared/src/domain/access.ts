import type { Level } from "./structure";

export type AccessGate =
    | NoGate
    | Sns1NeuronGate
    | OpenChatNeuronGate
    | DiamondGate
    | NnsNeuronGate
    | HotOrNotNeuronGate
    | KinicNeuronGate
    | NftGate;

export type NoGate = { kind: "no_gate" };

export type NnsNeuronGate = { kind: "nns_gate" };

export type NftGate = { kind: "nft_gate" };

export type SNSAccessGate =
    | Sns1NeuronGate
    | OpenChatNeuronGate
    | KinicNeuronGate
    | HotOrNotNeuronGate;

export function isSnsGate(gate: AccessGate): gate is SNSAccessGate {
    return (
        gate.kind === "hotornot_gate" ||
        gate.kind === "kinic_gate" ||
        gate.kind === "openchat_gate" ||
        gate.kind === "sns1_gate"
    );
}

type SnsNeuronGate = {
    minStakeE8s?: number;
    minDissolveDelay?: number;
};

export type HotOrNotNeuronGate = SnsNeuronGate & {
    kind: "hotornot_gate";
};

export type KinicNeuronGate = SnsNeuronGate & {
    kind: "kinic_gate";
};

export type Sns1NeuronGate = SnsNeuronGate & {
    kind: "sns1_gate";
};

export type OpenChatNeuronGate = SnsNeuronGate & {
    kind: "openchat_gate";
};

export type DiamondGate = { kind: "diamond_gate" };

export type AccessControlled = {
    gate: AccessGate;
    public: boolean;
    frozen: boolean;
    historyVisible: boolean;
};

export type VersionedRules = Rules & {
    version: number;
}

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

If you break the rules you might be blocked and/or have your message(s) deleted.`
    }

    return {
        text,
        enabled: false,
        version: 0,
    };
}
