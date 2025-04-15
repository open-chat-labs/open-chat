use crate::{BotPermissions, EmptySuccessOrError, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub caller: UserId,
    pub granted_permissions: BotPermissions,
}

pub type Response = EmptySuccessOrError;
