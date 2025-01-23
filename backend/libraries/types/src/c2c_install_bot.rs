use crate::{SlashCommandPermissions, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub caller: UserId,
    pub granted_permissions: SlashCommandPermissions,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Frozen,
    NotAuthorized,
    AlreadyAdded,
}
