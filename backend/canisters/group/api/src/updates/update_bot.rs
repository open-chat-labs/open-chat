use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{SlashCommandPermissions, UserId};

#[ts_export(group, update_bot)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub granted_permissions: SlashCommandPermissions,
}

#[ts_export(group, update_bot)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatFrozen,
    NotAuthorized,
    NotFound,
}
