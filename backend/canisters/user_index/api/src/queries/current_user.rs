use candid::CandidType;
use ic_ledger_types::AccountIdentifier;
use serde::{Deserialize, Serialize};
use types::{CanisterUpgradeStatus, DiamondMembershipDetails, TimestampMillis, UserId, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    UserNotFound,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub user_id: UserId,
    pub username: String,
    pub avatar_id: Option<u128>,
    pub canister_upgrade_status: CanisterUpgradeStatus,
    pub wasm_version: Version,
    pub icp_account: AccountIdentifier,
    pub referrals: Vec<UserId>,
    pub is_super_admin: bool,
    pub suspension_details: Option<SuspensionDetails>,
    pub is_suspected_bot: bool,
    pub diamond_membership_details: Option<DiamondMembershipDetails>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuspensionDetails {
    pub reason: String,
    pub action: SuspensionAction,
    pub suspended_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum SuspensionAction {
    Unsuspend(TimestampMillis),
    Delete(TimestampMillis),
}
