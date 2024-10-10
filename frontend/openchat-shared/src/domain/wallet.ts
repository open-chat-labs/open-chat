import type { DelegationChain } from "@dfinity/identity";

export type Verification = NoVerification | PinVerification | DelegationVerification;

export type NoVerification = { kind: "no_verification" };
export type PinVerification = { kind: "pin_verification"; pin: string };
export type DelegationVerification = {
    kind: "delegation_verification";
    delegation: DelegationChain;
};
