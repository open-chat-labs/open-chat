use candid::CandidType;
use ic_ledger_types::AccountIdentifier;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::{
    BuildVersion, CanisterUpgradeStatus, DiamondMembershipDetails, DiamondMembershipStatusFull, Empty, SuspensionDetails,
    TimestampMillis, UserId,
};

pub type Args = Empty;

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/currentUser.ts")]
#[serde(tag = "kind")]
pub enum Response {
    Success(SuccessResult),
    UserNotFound,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/currentUser.ts")]
pub struct SuccessResult {
    pub user_id: UserId,
    pub username: String,
    pub date_created: TimestampMillis,
    pub display_name: Option<String>,
    pub avatar_id: Option<u128>,
    pub canister_upgrade_status: CanisterUpgradeStatus,
    pub wasm_version: BuildVersion,
    #[ts(as = "String")]
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
}
