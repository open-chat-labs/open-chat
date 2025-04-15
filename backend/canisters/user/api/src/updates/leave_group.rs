use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChatId, EmptySuccessOrError};

#[ts_export(user, leave_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
}

pub type Response = EmptySuccessOrError;
