import type { AccessGate, InterpolationValues, SNSAccessGate } from "openchat-client";

export type GateBinding = {
    index: number;
    label: string;
    gate: AccessGate;
    enabled: boolean;
    cssClass: string;
    labelParams?: InterpolationValues;
};

const ocGate: GateBinding = {
    index: 2,
    label: "access.snsHolder",
    gate: { kind: "openchat_gate" },
    enabled: true,
    cssClass: "oc",
    labelParams: { token: "CHAT" },
};

const kinicGate: GateBinding = {
    index: 4,
    label: "access.snsHolder",
    gate: { kind: "kinic_gate" },
    enabled: true,
    cssClass: "kinic",
    labelParams: { token: "KINIC" },
};

const hotOrNotGate: GateBinding = {
    index: 5,
    label: "access.snsHolder",
    gate: { kind: "hotornot_gate" },
    enabled: true,
    cssClass: "hotornot",
    labelParams: { token: "HOT" },
};

const sns1Gate: GateBinding = {
    index: 3,
    label: "access.snsHolder",
    gate: { kind: "sns1_gate" },
    enabled: true,
    cssClass: "sns1",
    labelParams: { token: "SNS-1" },
};

export const snsGateBindings: Record<SNSAccessGate["kind"], GateBinding> = {
    openchat_gate: ocGate,
    sns1_gate: sns1Gate,
    kinic_gate: kinicGate,
    hotornot_gate: hotOrNotGate,
};

export const gateBindings: GateBinding[] = [
    {
        index: 0,
        label: "access.openAccess",
        gate: { kind: "no_gate" },
        enabled: true,
        cssClass: "open",
    },
    {
        index: 1,
        label: "access.diamondMember",
        gate: { kind: "diamond_gate" },
        enabled: true,
        cssClass: "diamond",
    },
    ocGate,
    sns1Gate,
    kinicGate,
    hotOrNotGate,
    {
        index: 6,
        label: "access.nnsHolder",
        gate: { kind: "nns_gate" },
        enabled: false,
        cssClass: "nns",
    },
    {
        index: 7,
        label: "access.nftHolder",
        gate: { kind: "nft_gate" },
        enabled: false,
        cssClass: "nft",
    },
];
