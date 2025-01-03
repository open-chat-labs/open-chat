// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { GroupSendMessageSuccessResult } from "./GroupSendMessageSuccessResult";
import type { InvalidPollReason } from "../../shared/InvalidPollReason";

export type GroupSendMessageResponse = { "Success": GroupSendMessageSuccessResult } | "ThreadMessageNotFound" | "MessageEmpty" | { "TextTooLong": number } | { "InvalidPoll": InvalidPollReason } | "NotAuthorized" | "CallerNotInGroup" | "UserSuspended" | "UserLapsed" | { "InvalidRequest": string } | "ChatFrozen" | "RulesNotAccepted" | "MessageAlreadyExists";
