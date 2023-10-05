import type { AccessGate, CryptocurrencyDetails, InterpolationValues } from "openchat-client";

export type GateBinding = {
    key: string;
    label: string;
    gate: AccessGate;
    enabled: boolean;
    cssClass: string;
    labelParams?: InterpolationValues;
};

function getSnsGateBindings(cryptoLookup: Record<string, CryptocurrencyDetails>): GateBinding[] {
    return Object.values(cryptoLookup).map((v) => {
        return {
            label: "access.snsHolder",
            gate: { kind: "sns_gate", governanceCanister: v.governanceCanister! },
            key: `sns_gate_${v.symbol.toLowerCase()}`,
            enabled: true,
            cssClass: v.symbol.toLowerCase(),
            labelParams: { token: v.symbol },
        };
    });
}

const noGate: GateBinding = {
    label: "access.openAccess",
    key: "no_gate",
    gate: { kind: "no_gate" },
    enabled: true,
    cssClass: "open",
};

const diamondGate: GateBinding = {
    label: "access.diamondMember",
    key: "diamond_gate",
    gate: { kind: "diamond_gate" },
    enabled: true,
    cssClass: "diamond",
};

const nnsGate: GateBinding = {
    label: "access.nnsHolder",
    key: "nns_gate",
    gate: { kind: "nns_gate" },
    enabled: false,
    cssClass: "nns",
};

const nftGate: GateBinding = {
    label: "access.nftHolder",
    key: "nft_gate",
    gate: { kind: "nft_gate" },
    enabled: false,
    cssClass: "nft",
};

const credentialGate: GateBinding = {
    label: "access.credential",
    key: "credential_gate",
    gate: { kind: "credential_gate", issuer: "", credential: "" },
    enabled: true,
    cssClass: "credential",
};

export function getGateBindings(
    cryptoLookup: Record<string, CryptocurrencyDetails>,
): GateBinding[] {
    return [
        noGate,
        diamondGate,
        credentialGate,
        ...getSnsGateBindings(cryptoLookup),
        nnsGate,
        nftGate,
    ];
}
