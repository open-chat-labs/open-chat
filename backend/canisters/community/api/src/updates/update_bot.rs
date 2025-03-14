use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotPermissions, UserId};

#[ts_export(community, update_bot)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub granted_permissions: BotPermissions,
}

#[ts_export(community, update_bot)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CommunityFrozen,
    NotAuthorized,
    NotFound,
    Error(OCError),
}
