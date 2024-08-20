// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { userIndexPayForDiamondMembershipSuccessResult } from "./userIndexPayForDiamondMembershipSuccessResult";

export type userIndexPayForDiamondMembershipResponse = { "Success": userIndexPayForDiamondMembershipSuccessResult } | "AlreadyLifetimeDiamondMember" | "CurrencyNotSupported" | "PriceMismatch" | "PaymentAlreadyInProgress" | "UserNotFound" | { "InsufficientFunds": bigint } | { "TransferFailed": string } | { "InternalError": string };
