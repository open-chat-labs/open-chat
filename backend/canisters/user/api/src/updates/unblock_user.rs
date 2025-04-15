use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{EmptySuccessOrError, UserId};

#[ts_export(user, unblock_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
}

pub type Response = EmptySuccessOrError;
