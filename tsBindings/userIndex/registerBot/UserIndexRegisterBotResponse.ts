// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { UserIndexRegisterBotSuccessResult } from "./UserIndexRegisterBotSuccessResult";

export type UserIndexRegisterBotResponse = { "Success": UserIndexRegisterBotSuccessResult } | "AlreadyRegistered" | { "InvalidRequest": string } | { "InternalError": string } | "UserSuspended";
