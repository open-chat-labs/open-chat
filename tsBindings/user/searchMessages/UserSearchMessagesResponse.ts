// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { UserSearchMessagesSuccessResult } from "./UserSearchMessagesSuccessResult";

export type UserSearchMessagesResponse = { "Success": UserSearchMessagesSuccessResult } | "InvalidTerm" | { "TermTooLong": number } | { "TermTooShort": number } | "ChatNotFound";
