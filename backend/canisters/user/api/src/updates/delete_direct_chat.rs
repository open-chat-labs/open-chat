use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{UnitResult, UserId};

#[ts_export(user, delete_direct_chat)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub block_user: bool,
}

pub type Response = UnitResult;
