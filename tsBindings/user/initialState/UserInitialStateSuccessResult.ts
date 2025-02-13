// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { ChitEarned } from "../../shared/ChitEarned";
import type { InstalledBotDetails } from "../../shared/InstalledBotDetails";
import type { PinNumberSettings } from "../../shared/PinNumberSettings";
import type { PublicApiKeyDetails } from "../../shared/PublicApiKeyDetails";
import type { StreakInsurance } from "../../shared/StreakInsurance";
import type { TSPrincipal } from "../../shared/TSPrincipal";
import type { UserId } from "../../shared/UserId";
import type { UserInitialStateCommunitiesInitial } from "./UserInitialStateCommunitiesInitial";
import type { UserInitialStateDirectChatsInitial } from "./UserInitialStateDirectChatsInitial";
import type { UserInitialStateFavouriteChatsInitial } from "./UserInitialStateFavouriteChatsInitial";
import type { UserInitialStateGroupChatsInitial } from "./UserInitialStateGroupChatsInitial";
import type { UserMessageActivitySummary } from "../UserMessageActivitySummary";
import type { UserReferral } from "../UserReferral";
import type { UserWalletConfig } from "../UserWalletConfig";

export type UserInitialStateSuccessResult = { timestamp: bigint, direct_chats: UserInitialStateDirectChatsInitial, group_chats: UserInitialStateGroupChatsInitial, favourite_chats: UserInitialStateFavouriteChatsInitial, communities: UserInitialStateCommunitiesInitial, avatar_id?: bigint, blocked_users: Array<UserId>, suspended: boolean, pin_number_settings?: PinNumberSettings, local_user_index_canister_id: TSPrincipal, achievements: Array<ChitEarned>, achievements_last_seen: bigint, total_chit_earned: number, chit_balance: number, streak: number, streak_ends: bigint, streak_insurance?: StreakInsurance, next_daily_claim: bigint, is_unique_person: boolean, wallet_config: UserWalletConfig, referrals: Array<UserReferral>, message_activity_summary: UserMessageActivitySummary, bots: Array<InstalledBotDetails>, api_keys: Array<PublicApiKeyDetails>, };
