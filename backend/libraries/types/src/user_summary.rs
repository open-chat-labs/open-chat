use crate::{
    BotConfig, DiamondMembershipDetails, DiamondMembershipStatus, DiamondMembershipStatusFull, SuspensionDetails, UserId,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct UserSummary {
    pub user_id: UserId,
    pub username: String,
    #[ts(optional)]
    pub display_name: Option<String>,
    #[ts(optional)]
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

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct UserSummaryV2 {
    pub user_id: UserId,
    #[ts(optional)]
    pub stable: Option<UserSummaryStable>,
    #[ts(optional)]
    pub volatile: Option<UserSummaryVolatile>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct UserSummaryStable {
    pub username: String,
    #[ts(optional)]
    pub display_name: Option<String>,
    #[ts(optional)]
    pub avatar_id: Option<u128>,
    pub is_bot: bool,
    pub suspended: bool,
    pub diamond_membership_status: DiamondMembershipStatus,
    pub is_unique_person: bool,
    #[ts(optional)]
    pub bot_config: Option<BotConfig>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct UserSummaryVolatile {
    pub total_chit_earned: i32,
    pub chit_balance: i32,
    pub streak: u16,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct CurrentUserSummary {
    pub user_id: UserId,
    pub username: String,
    #[ts(optional)]
    pub display_name: Option<String>,
    #[ts(optional)]
    pub avatar_id: Option<u128>,
    pub is_bot: bool,
    pub is_platform_moderator: bool,
    pub is_platform_operator: bool,
    #[ts(optional)]
    pub suspension_details: Option<SuspensionDetails>,
    pub is_suspected_bot: bool,
    #[ts(optional)]
    pub diamond_membership_details: Option<DiamondMembershipDetails>,
    pub diamond_membership_status: DiamondMembershipStatusFull,
    pub moderation_flags_enabled: u32,
    pub is_unique_person: bool,
}
