import type { AccessGate } from "openchat-client";

export type GateBinding = {
    index: number;
    label: string;
    gate: AccessGate;
    enabled: boolean;
};

export const gateBindings: GateBinding[] = [
    {
        index: 0,
        label: "access.openAccess",
        gate: { kind: "no_gate" },
        enabled: true,
    },
    {
        index: 1,
        label: "access.diamondMember",
        gate: { kind: "diamond_gate" },
        enabled: true,
    },
    {
        index: 2,
        label: "access.chatHolder",
        gate: { kind: "openchat_gate" },
        enabled: true,
    },
    {
        index: 3,
        label: "access.sns1Holder",
        gate: { kind: "sns1_gate" },
        enabled: true,
    },
    {
        index: 4,
        label: "access.nnsHolder",
        gate: { kind: "nns_gate" },
        enabled: false,
    },
    {
        index: 5,
        label: "access.nftHolder",
        gate: { kind: "nft_gate" },
        enabled: false,
    },
];
