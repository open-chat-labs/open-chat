use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotInstallationLocation, BotPermissions, TimestampMillis, UserId};

#[ts_export(user_index, bot_installations)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub from: u32,
    pub size: u16,
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
    pub events: Vec<BotInstallationEvent>,
}

#[ts_export(user_index, bot_installations)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum BotInstallationEvent {
    Installed(BotInstalled),
    Uninstalled(BotUninstalled),
}

#[ts_export(user_index, bot_installations)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BotInstalled {
    pub location: BotInstallationLocation,
    pub granted_permissions: BotPermissions,
    pub granted_autonomous_permissions: BotPermissions,
    pub installed_by: UserId,
    pub timestamp: TimestampMillis,
}

#[ts_export(user_index, bot_installations)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BotUninstalled {
    pub location: BotInstallationLocation,
    pub uninstalled_by: UserId,
    pub timestamp: TimestampMillis,
}
