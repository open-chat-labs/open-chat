use crate::{BotPermissions, UserId};
use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub caller: UserId,
    pub granted_permissions: BotPermissions,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Frozen,
    NotAuthorized,
    AlreadyAdded,
    Error(OCError),
}
