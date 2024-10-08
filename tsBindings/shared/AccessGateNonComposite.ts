// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { PaymentGate } from "./PaymentGate";
import type { SnsNeuronGate } from "./SnsNeuronGate";
import type { TokenBalanceGate } from "./TokenBalanceGate";
import type { VerifiedCredentialGate } from "./VerifiedCredentialGate";

export type AccessGateNonComposite = "DiamondMember" | "LifetimeDiamondMember" | "UniquePerson" | { "VerifiedCredential": VerifiedCredentialGate } | { "SnsNeuron": SnsNeuronGate } | { "Payment": PaymentGate } | { "TokenBalance": TokenBalanceGate } | "Locked" | "ReferredByMember";
