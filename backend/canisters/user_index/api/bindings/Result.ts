// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { CurrentUserSummary } from "./CurrentUserSummary";
import type { UserId } from "./UserId";
import type { UserSummaryV2 } from "./UserSummaryV2";

export type Result = { users: Array<UserSummaryV2>, current_user: CurrentUserSummary | null, deleted: Array<UserId>, timestamp: bigint, };
