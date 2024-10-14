// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { BotConfig } from "./BotConfig";
import type { DiamondMembershipStatus } from "./DiamondMembershipStatus";
import type { TSBoolWithDefault } from "./TSBoolWithDefault";

export type UserSummaryStable = { username: string, display_name?: string | undefined, avatar_id?: bigint | undefined, is_bot: TSBoolWithDefault, suspended: TSBoolWithDefault, diamond_membership_status: DiamondMembershipStatus, is_unique_person: TSBoolWithDefault, bot_config?: BotConfig | undefined, };
