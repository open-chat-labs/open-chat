use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{UnitResult, UserId};

#[ts_export(community, block_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
}

pub type Response = UnitResult;
