use crate::{
    DiamondMembershipDetails, DiamondMembershipStatus, DiamondMembershipStatusFull, SuspensionDetails, TimestampMillis, UserId,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};

// Deprecated
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
    pub chit_balance: i32,
    pub streak: u16,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserSummaryV2 {
    pub user_id: UserId,
    pub stable: Option<UserSummaryStable>,
    pub volatile: Option<UserSummaryVolatile>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserSummaryStable {
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_id: Option<u128>,
    pub is_bot: bool,
    pub suspended: bool,
    pub diamond_membership_status: DiamondMembershipStatus,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserSummaryVolatile {
    pub chit_balance: i32,
    pub streak: u16,
}

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
    pub chit_balance: i32,
    pub streak: u16,
    pub next_daily_claim: TimestampMillis,
}
