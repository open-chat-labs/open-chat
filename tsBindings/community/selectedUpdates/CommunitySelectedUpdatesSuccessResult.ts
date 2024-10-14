// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { CommunityMember } from "../../shared/CommunityMember";
import type { TSBigIntWithDefault } from "../../shared/TSBigIntWithDefault";
import type { UserGroupDetails } from "../../shared/UserGroupDetails";
import type { UserId } from "../../shared/UserId";
import type { VersionedRules } from "../../shared/VersionedRules";

export type CommunitySelectedUpdatesSuccessResult = { timestamp: TSBigIntWithDefault, last_updated: TSBigIntWithDefault, 
/**
 * @default []
 */
members_added_or_updated: Array<CommunityMember>, 
/**
 * @default []
 */
members_removed: Array<UserId>, 
/**
 * @default []
 */
blocked_users_added: Array<UserId>, 
/**
 * @default []
 */
blocked_users_removed: Array<UserId>, invited_users?: Array<UserId> | undefined, chat_rules?: VersionedRules | undefined, 
/**
 * @default []
 */
user_groups: Array<UserGroupDetails>, 
/**
 * @default []
 */
user_groups_deleted: Array<number>, 
/**
 * @default []
 */
referrals_added: Array<UserId>, 
/**
 * @default []
 */
referrals_removed: Array<UserId>, };
