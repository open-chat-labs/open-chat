// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { FieldTooLongResult } from "../../shared/FieldTooLongResult";

export type UserSetMessageReminderV2Response = { "Success": bigint } | "ReminderDateInThePast" | { "NotesTooLong": FieldTooLongResult } | "UserSuspended";
