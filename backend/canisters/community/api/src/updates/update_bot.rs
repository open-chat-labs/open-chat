use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotPermissions, EmptySuccessOrError, UserId};

#[ts_export(community, update_bot)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub granted_permissions: BotPermissions,
}

pub type Response = EmptySuccessOrError;
