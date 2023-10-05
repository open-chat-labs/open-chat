import type { Level } from "./structure";

export type AccessGate =
    | NoGate
    | SNSAccessGate
    | DiamondGate
    | NnsNeuronGate
    | NftGate
    | CredentialGate;

export type NoGate = { kind: "no_gate" };

export type NnsNeuronGate = { kind: "nns_gate" };

export type NftGate = { kind: "nft_gate" };

// TODO - this might end up being more complex e.g. a credential might not simply be a string it might be more complex like e.g. age > 18
export type CredentialGate = {
    kind: "credential_gate";
    issuer: string;
    credential: string;
};

export type SNSAccessGate = {
    kind: "sns_gate";
    governanceCanister: string;
    minStakeE8s?: number;
    minDissolveDelay?: number;
};

export function isSnsGate(gate: AccessGate): gate is SNSAccessGate {
    return gate.kind === "sns_gate";
}

export type DiamondGate = { kind: "diamond_gate" };

export type AccessControlled = {
    gate: AccessGate;
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
