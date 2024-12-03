use crate::{DiamondMembershipDetails, DiamondMembershipStatus, DiamondMembershipStatusFull, SuspensionDetails, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserSummary {
    pub user_id: UserId,
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_id: Option<u128>,
    pub is_bot: bool,
    pub suspended: bool,
    pub diamond_member: bool,
    pub diamond_membership_status: DiamondMembershipStatus,
    pub total_chit_earned: i32,
    pub chit_balance: i32,
    pub streak: u16,
    pub is_unique_person: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserSummaryV2 {
    pub user_id: UserId,
    pub stable: Option<UserSummaryStable>,
    pub volatile: Option<UserSummaryVolatile>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserSummaryStable {
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_id: Option<u128>,
    pub is_bot: bool,
    pub suspended: bool,
    pub diamond_membership_status: DiamondMembershipStatus,
    pub is_unique_person: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserSummaryVolatile {
    pub total_chit_earned: i32,
    pub chit_balance: i32,
    pub streak: u16,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct CurrentUserSummary {
    pub user_id: UserId,
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_id: Option<u128>,
    pub is_bot: bool,
    pub is_platform_moderator: bool,
    pub is_platform_operator: bool,
    pub suspension_details: Option<SuspensionDetails>,
    pub is_suspected_bot: bool,
    pub diamond_membership_details: Option<DiamondMembershipDetails>,
    pub diamond_membership_status: DiamondMembershipStatusFull,
    pub moderation_flags_enabled: u32,
    pub is_unique_person: bool,
}
