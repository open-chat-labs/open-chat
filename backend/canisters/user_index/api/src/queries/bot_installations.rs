use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotInstallationLocation, BotPermissions, CanisterId, TimestampMillis};

#[ts_export(user_index, bot_installations)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub installed_since: Option<BotInstallationLocation>,
    pub max_results: u16,
}

#[ts_export(user_index, bot_installations)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(user_index, bot_installations)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub installations: Vec<InstallationDetails>,
}

#[ts_export(user_index, bot_installations)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct InstallationDetails {
    pub location: BotInstallationLocation,
    pub installed_at: TimestampMillis,
    pub local_user_index: CanisterId,
    pub granted_permissions: BotPermissions,
    pub granted_autonomous_permissions: BotPermissions,
}
