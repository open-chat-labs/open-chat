use crate::{
    DiamondMembershipDetails, DiamondMembershipStatus, DiamondMembershipStatusFull, SuspensionDetails, UserId, is_default,
};
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
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub is_bot: bool,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub suspended: bool,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub diamond_member: bool,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<DiamondMembershipStatus>", optional)]
    pub diamond_membership_status: DiamondMembershipStatus,
    pub total_chit_earned: i32,
    pub chit_balance: i32,
    pub streak: u16,
    pub max_streak: u16,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub is_unique_person: bool,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub hide_online_status: bool,
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
    pub profile_background_id: Option<u128>,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub is_bot: bool,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub suspended: bool,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<DiamondMembershipStatus>", optional)]
    pub diamond_membership_status: DiamondMembershipStatus,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub is_unique_person: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserSummaryVolatile {
    pub total_chit_earned: i32,
    pub chit_balance: i32,
    pub streak: u16,
    pub max_streak: u16,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct CurrentUserSummary {
    pub user_id: UserId,
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_id: Option<u128>,
    pub profile_background_id: Option<u128>,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub is_bot: bool,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub is_platform_moderator: bool,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub is_platform_operator: bool,
    pub suspension_details: Option<SuspensionDetails>,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub is_suspected_bot: bool,
    pub diamond_membership_details: Option<DiamondMembershipDetails>,
    #[serde(default, skip_serializing_if = "DiamondMembershipStatusFull::is_inactive")]
    #[ts(as = "Option<DiamondMembershipStatusFull>", optional)]
    pub diamond_membership_status: DiamondMembershipStatusFull,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub moderation_flags_enabled: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub is_unique_person: bool,
    pub total_chit_earned: i32,
    pub chit_balance: i32,
    pub streak: u16,
    pub max_streak: u16,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub hide_online_status: bool,
}
