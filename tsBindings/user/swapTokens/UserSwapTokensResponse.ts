// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { UserSwapTokensSuccessResult } from "./UserSwapTokensSuccessResult";

export type UserSwapTokensResponse = { "Success": UserSwapTokensSuccessResult } | "SwapFailed" | "PinRequired" | { "PinIncorrect": bigint } | { "TooManyFailedPinAttempts": bigint } | { "InternalError": string };
