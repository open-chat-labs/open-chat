// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { CompletedCryptoTransaction } from "../../shared/CompletedCryptoTransaction";
import type { FailedCryptoTransaction } from "../../shared/FailedCryptoTransaction";

export type CommunityClaimPrizeResponse = "Success" | "MessageNotFound" | "UserNotInCommunity" | "UserNotInChannel" | "UserSuspended" | "CommunityFrozen" | "ChannelNotFound" | "AlreadyClaimed" | "PrizeFullyClaimed" | "PrizeEnded" | "LedgerError" | { "TransferFailed": [string, FailedCryptoTransaction] } | { "FailedAfterTransfer": [string, CompletedCryptoTransaction] } | { "InternalError": string } | "UserLapsed";
