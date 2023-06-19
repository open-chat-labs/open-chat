import type { MemberRole } from "./permission";

export type AccessGate =
    | NoGate
    | Sns1NeuronGate
    | OpenChatNeuronGate
    | DiamondGate
    | NnsNeuronGate
    | NftGate;

export type NoGate = { kind: "no_gate" };

export type NnsNeuronGate = { kind: "nns_gate" };

export type NftGate = { kind: "nft_gate" };

type SnsNeuronGate = {
    minStakeE8s?: number;
    minDissolveDelay?: number;
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

export const defaultAccessRuleText = `- Do not impersonate others in a deceptive or misleading manner
- Do not intentionally share false or misleading information
- Keep messages relevant to the group

If you break the rules you might be blocked and/or have your message(s) deleted.`;

export const defaultAccessRules: AccessRules = {
    text: defaultAccessRuleText,
    enabled: false,
};
