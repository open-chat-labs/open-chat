// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { AcceptSwapSuccess } from "../../shared/AcceptSwapSuccess";
import type { SwapStatusError } from "../../shared/SwapStatusError";

export type UserAcceptP2pSwapResponse = { "Success": AcceptSwapSuccess } | "ChatNotFound" | "InsufficientFunds" | { "StatusError": SwapStatusError } | "SwapNotFound" | "UserSuspended" | "PinRequired" | { "PinIncorrect": bigint } | { "TooManyFailedPinAttempts": bigint } | { "InternalError": string };