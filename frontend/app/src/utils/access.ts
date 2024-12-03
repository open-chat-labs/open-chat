import { get } from "svelte/store";
import { _ } from "svelte-i18n";
import {
    type AccessGate,
    type Credential,
    type CredentialGate,
    type CryptocurrencyDetails,
    type EnhancedAccessGate,
    type Level,
    type NervousSystemDetails,
} from "openchat-client";

export type GateBinding = {
    key: string;
    label: string;
    enabled: boolean;
    gate: AccessGate;
};

export const gateLabel: Record<AccessGate["kind"], string> = {
    no_gate: "access.openAccess",
    composite_gate: "access.compositeGate",
    credential_gate: "access.credential.label",
    diamond_gate: "access.diamondMember",
    lifetime_diamond_gate: "access.lifetimeDiamondMember",
    neuron_gate: "access.neuronHolder",
    nft_gate: "access.nftHolder",
    payment_gate: "access.payment",
    token_balance_gate: "access.tokenBalance",
    unique_person_gate: "access.uniquePerson",
    locked_gate: "access.lockedGate",
    referred_by_member_gate: "access.referredByMember",
};

export function getGateBindings(level: Level): GateBinding[] {
    const gates = [
        noGate,
        diamondGate,
        lifetimeDiamondGate,
        neuronGateFolder,
        paymentGateFolder,
        balanceGateFolder,
        credentialGate,
        uniquePersonGate,
        lockedGate,
    ];
    if (level === "community") {
        gates.push(referredByMemberGate);
    }
    gates.push(nftGate);
    return gates;
}

export function getNeuronGateBindings(
    nervousSystemLookup: Record<string, NervousSystemDetails>,
): GateBinding[] {
    return Object.values(nervousSystemLookup).map((ns) => {
        return {
            label: formatLabel(ns.token.name, ns.isNns),
            gate: {
                kind: "neuron_gate",
                governanceCanister: ns.governanceCanisterId,
            },
            key: ns.governanceCanisterId,
            enabled: !ns.isNns,
        };
    });
}

export function getPaymentGateBindings(
    cryptoLookup: Record<string, CryptocurrencyDetails>,
    nsLedgers: Set<string>,
): GateBinding[] {
    return Object.values(cryptoLookup)
        .filter((c) => c.supportedStandards.includes("ICRC-2") || nsLedgers.has(c.ledger))
        .map((c) => {
            const enabled = c.supportedStandards.includes("ICRC-2") || c.symbol === "ICP";
            return {
                label: formatLabel(c.symbol, !enabled),
                gate: {
                    kind: "payment_gate",
                    ledgerCanister: c.ledger,
                    amount: BigInt(100) * c.transferFee,
                    fee: c.transferFee,
                },
                key: c.ledger,
                enabled,
            };
        });
}

export function getBalanceGateBindings(
    cryptoLookup: Record<string, CryptocurrencyDetails>,
): GateBinding[] {
    return Object.values(cryptoLookup).map((c) => {
        return {
            label: formatLabel(c.symbol, false),
            gate: {
                kind: "token_balance_gate",
                ledgerCanister: c.ledger,
                minBalance: BigInt(100) * c.transferFee,
            },
            key: c.ledger,
            enabled: true,
        };
    });
}

function formatLabel(token: string, comingSoon: boolean): string {
    return comingSoon ? get(_)("access.tokenComingSoon", { values: { token } }) : token;
}

const noGate: GateBinding = {
    label: "access.openAccess",
    key: "no_gate",
    gate: { kind: "no_gate" },
    enabled: true,
};

const diamondGate: GateBinding = {
    label: "access.diamondMember",
    key: "diamond_gate",
    gate: { kind: "diamond_gate" },
    enabled: true,
};

const lifetimeDiamondGate: GateBinding = {
    label: "access.lifetimeDiamondMember",
    key: "lifetime_diamond_gate",
    gate: { kind: "lifetime_diamond_gate" },
    enabled: true,
};

export const uniquePersonGate: GateBinding = {
    label: "access.uniquePerson",
    key: "unique_person_gate",
    gate: { kind: "unique_person_gate" },
    enabled: true,
};

export const lockedGate: GateBinding = {
    label: "access.lockedGate",
    key: "locked_gate",
    gate: { kind: "locked_gate" },
    enabled: true,
};

export const referredByMemberGate: GateBinding = {
    label: "access.referredByMember",
    key: "referred_by_member_gate",
    gate: { kind: "referred_by_member_gate" },
    enabled: false,
};

export const neuronGateFolder: GateBinding = {
    label: "access.neuronHolder",
    key: "neuron_gate_folder",
    gate: {
        kind: "neuron_gate",
        governanceCanister: "",
    },
    enabled: true,
};

export const paymentGateFolder: GateBinding = {
    label: "access.payment",
    key: "payment_gate_folder",
    gate: {
        kind: "payment_gate",
        ledgerCanister: "",
        amount: 0n,
        fee: 0n,
    },
    enabled: true,
};

export const balanceGateFolder: GateBinding = {
    label: "access.minimumBalance",
    key: "balance_gate_folder",
    gate: {
        kind: "token_balance_gate",
        ledgerCanister: "",
        minBalance: 0n,
    },
    enabled: true,
};

const nftGate: GateBinding = {
    label: "access.nftHolder",
    key: "nft_gate",
    gate: { kind: "nft_gate" },
    enabled: false,
};

export const uniquePersonCredentialGate: CredentialGate = {
    kind: "credential_gate",
    credential: {
        credentialName: "Is human",
        issuerCanisterId: "qgxyr-pyaaa-aaaah-qdcwq-cai",
        issuerOrigin: "https://id.decideai.xyz",
        credentialType: "ProofOfUniqueness",
    },
};

const credentialGate: GateBinding = {
    label: "access.credential.label",
    key: "credential_gate",
    gate: {
        kind: "credential_gate",
        credential: {
            credentialName: "",
            issuerCanisterId: "",
            issuerOrigin: "",
            credentialType: "",
        },
    },
    enabled: true,
};

export const credentialIssuers: Credential[] = [
    {
        credentialName: "Is DFINITY employee",
        issuerCanisterId: "vu2yf-xiaaa-aaaad-aad5q-cai",
        issuerOrigin: "https://vu2yf-xiaaa-aaaad-aad5q-cai.icp0.io",
        credentialType: "VerifiedEmployee",
        credentialArguments: {
            employerName: "DFINITY Foundation",
        },
    },
    {
        credentialName: "Is early adopter",
        issuerCanisterId: "vuq4g-oyaaa-aaaap-ahfsq-cai",
        issuerOrigin: "https://vuq4g-oyaaa-aaaap-ahfsq-cai.icp0.io",
        credentialType: "EventAttendance",
        credentialArguments: {
            eventName: "DICE2024",
        },
    },
];

function minExpiry(e1: bigint | undefined, e2: bigint | undefined): bigint | undefined {
    if (e1 === undefined && e2 === undefined) return undefined;
    if (e1 === undefined) return e2;
    if (e2 === undefined) return e1;
    return BigInt(Math.min(Number(e1), Number(e2)));
}

function canGatesBeMerged(g1: EnhancedAccessGate, g2: EnhancedAccessGate): boolean {
    return (
        (g1.kind === "diamond_gate" && g2.kind === "diamond_gate") ||
        (g1.kind === "lifetime_diamond_gate" && g2.kind === "lifetime_diamond_gate") ||
        (g1.kind === "locked_gate" && g2.kind === "locked_gate") ||
        (g1.kind === "referred_by_member_gate" && g2.kind === "referred_by_member_gate") ||
        (g1.kind === "unique_person_gate" && g2.kind === "unique_person_gate")
    );
}

export function mergeAccessGates(
    g1?: EnhancedAccessGate,
    g2?: EnhancedAccessGate,
): EnhancedAccessGate[] {
    if (g1 === undefined) return [];
    if (g2 === undefined) return [g1];

    if (canGatesBeMerged(g1, g2)) {
        return [
            {
                ...g1,
                expiry: minExpiry(g1.expiry, g2.expiry),
            },
        ];
    }
    return [g1, g2];
}
