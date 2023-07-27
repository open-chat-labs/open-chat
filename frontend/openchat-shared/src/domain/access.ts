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

// annoyingly this is a not part of the AccessControlled type although it feels like it *should* be
export type AccessRules = {
    text: string;
    enabled: boolean;
};


export function defaultAccessRules(level: Level): AccessRules {
    const LEVEL_TEXT: Map<Level, string> = new Map([
        ["channel", "the channel"],
        ["group", "the group"],
        ["community", "each channel"],
    ]);

    return {
        text: `- Do not impersonate others in a deceptive or misleading manner
- Do not intentionally share false or misleading information
- Keep messages relevant to ${LEVEL_TEXT.get(level)}

If you break the rules you might be blocked and/or have your message(s) deleted.`,
        enabled: false,
    };
}
