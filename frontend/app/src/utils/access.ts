import type { AccessGate, InterpolationValues, NervousSystemDetails } from "openchat-client";

export type GateBinding = {
    key: string;
    label: string;
    gate: AccessGate;
    enabled: boolean;
    cssClass: string;
    labelParams?: InterpolationValues;
};

function getSnsGateBindings(
    nervousSystemLookup: Record<string, NervousSystemDetails>,
): GateBinding[] {
    return Object.values(nervousSystemLookup)
        .filter((ns) => !ns.isNns)
        .map((ns) => {
            return {
                label: "access.snsHolder",
                gate: {
                    kind: "sns_gate",
                    governanceCanister: ns.governanceCanisterId,
                },
                key: ns.governanceCanisterId,
                enabled: true,
                cssClass: ns.token.symbol.toLowerCase(),
                labelParams: { token: ns.token.symbol },
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

// const credentialGate: GateBinding = {
//     label: "access.credential",
//     key: "credential_gate",
//     gate: { kind: "credential_gate", issuerOrigin: "", credentialId: "" },
//     enabled: true,
//     cssClass: "credential",
// };

export function getGateBindings(
    nervousSystemLookup: Record<string, NervousSystemDetails>,
): GateBinding[] {
    return [
        noGate,
        diamondGate,
        // credentialGate,
        ...getSnsGateBindings(nervousSystemLookup),
        nnsGate,
        nftGate,
    ];
}

export type Credential = {
    name: string;
    value: string;
};

export type CredentialIssuer = {
    name: string;
    value: string;
    credentials: Credential[];
};

export const credentialIssuers: CredentialIssuer[] = [
    {
        name: "Employment Info Ltd",
        value: "https://employment.info",
        credentials: [
            { value: "VerifiedEmployee", name: "Is verified employee" },
            { value: "SomeOther", name: "Some other thing" },
        ],
    },
    {
        name: "MODCLUB",
        value: "https://modclub.com",
        credentials: [{ value: "IsHuman", name: "Is a human" }],
    },
];
