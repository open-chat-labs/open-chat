import type { AccessGate, CryptocurrencyDetails, InterpolationValues } from "openchat-client";

export type GateBinding = {
    key: AccessGate["kind"];
    label: string;
    gate: AccessGate;
    enabled: boolean;
    cssClass: string;
    labelParams?: InterpolationValues;
};

function getSnsGateBindings(cryptoLookup: Record<string, CryptocurrencyDetails>): GateBinding[] {
    return Object.values(cryptoLookup).reduce((gates, next) => {
        if (next.nervousSystem !== undefined) {
            gates.push({
                label: "access.snsHolder",
                gate: {
                    kind: "sns_gate",
                    governanceCanister: next.nervousSystem.governanceCanisterId,
                },
                key: "sns_gate",
                enabled: true,
                cssClass: next.symbol.toLowerCase(),
                labelParams: { token: next.symbol },
            });
        }
        return gates;
    }, [] as GateBinding[]);
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
    cryptoLookup: Record<string, CryptocurrencyDetails>,
): GateBinding[] {
    return [
        noGate,
        diamondGate,
        // credentialGate,
        ...getSnsGateBindings(cryptoLookup),
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
