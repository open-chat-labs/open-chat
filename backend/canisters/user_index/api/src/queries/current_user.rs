use candid::CandidType;
use ic_ledger_types::AccountIdentifier;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    DiamondMembershipDetails, DiamondMembershipStatusFull, Empty, SuspensionDetails, TimestampMillis, UserId, is_default,
};

pub type Args = Empty;

#[expect(clippy::large_enum_variant)]
#[ts_export(user_index, current_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    UserNotFound,
    Error(OCError),
}

#[ts_export(user_index, current_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub user_id: UserId,
    pub username: String,
    pub date_created: TimestampMillis,
    pub display_name: Option<String>,
    pub avatar_id: Option<u128>,
    #[ts(as = "[u8; 32]")]
    pub icp_account: AccountIdentifier,
    pub referrals: Vec<UserId>,
    pub is_platform_moderator: bool,
    pub is_platform_operator: bool,
    pub suspension_details: Option<SuspensionDetails>,
    pub is_suspected_bot: bool,
    pub diamond_membership_details: Option<DiamondMembershipDetails>,
    pub diamond_membership_status: DiamondMembershipStatusFull,
    pub moderation_flags_enabled: u32,
    pub is_unique_person: bool,
    pub total_chit_earned: i32,
    pub chit_balance: i32,
    pub streak: u16,
    pub max_streak: u16,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub hide_online_status: bool,
}
