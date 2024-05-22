import { get } from "svelte/store";
import { _ } from "svelte-i18n";
import type {
    AccessGate,
    Credential,
    CredentialGate,
    CryptocurrencyDetails,
    NervousSystemDetails,
} from "openchat-client";

export type GateBinding = {
    key: string;
    label: string;
    enabled: boolean;
    gate: AccessGate;
};

export function getGateBindings(): GateBinding[] {
    return [
        noGate,
        diamondGate,
        neuronGateFolder,
        paymentGateFolder,
        balanceGateFolder,
        credentialGate,
        nftGate,
    ];
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

const neuronGateFolder: GateBinding = {
    label: "access.neuronHolder",
    key: "neuron_gate_folder",
    gate: { kind: "no_gate" },
    enabled: true,
};

const paymentGateFolder: GateBinding = {
    label: "access.payment",
    key: "payment_gate_folder",
    gate: { kind: "no_gate" },
    enabled: true,
};

const balanceGateFolder: GateBinding = {
    label: "access.minimumBalance",
    key: "balance_gate_folder",
    gate: { kind: "no_gate" },
    enabled: true,
};

const nftGate: GateBinding = {
    label: "access.nftHolder",
    key: "nft_gate",
    gate: { kind: "nft_gate" },
    enabled: false,
};

const credentialGate: GateBinding = {
    label: "access.credential",
    key: "credential_gate",
    gate: {
        kind: "credential_gate",
        credential: {
            issuerCanisterId: "",
            issuerOrigin: "",
            credentialType: "",
        },
    },
    enabled: true,
};

export type CredentialIssuer = Credential & { name: string };

export const credentialIssuers: CredentialIssuer[] = [
    {
        name: "Is DFINITY employee",
        issuerCanisterId: "vu2yf-xiaaa-aaaad-aad5q-cai",
        issuerOrigin: "https://vu2yf-xiaaa-aaaad-aad5q-cai.icp0.io",
        credentialType: "VerifiedEmployee",
        credentialArguments: {
            employerName: "DFINITY Foundation",
        },
    },
    // {
    //     name: "Is early adopter",
    //     issuerCanisterId: "vu2yf-xiaaa-aaaad-aad5q-cai",
    //     issuerOrigin: "https://vu2yf-xiaaa-aaaad-aad5q-cai.icp0.io",
    //     credentialType: "Early adopter",
    //     credentialArguments: {
    //         employerName: "DFINITY Foundation",
    //     },
    // },
    {
        name: "Is early adopter",
        issuerCanisterId: "vuq4g-oyaaa-aaaap-ahfsq-cai",
        issuerOrigin: "https://vuq4g-oyaaa-aaaap-ahfsq-cai.icp0.io",
        credentialType: "EventAttendance",
        credentialArguments: {
            eventName: "DICE2024",
        },
    },
];

export function findPredefinedIssuer(gate: CredentialGate) {
    return credentialIssuers.find(
        (i) =>
            i.credentialType === gate.credential.credentialType &&
            i.issuerOrigin === gate.credential.issuerOrigin,
    );
}
