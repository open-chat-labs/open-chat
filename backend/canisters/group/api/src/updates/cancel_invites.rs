use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{UnitResult, UserId};

#[ts_export(group, cancel_invites)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_ids: Vec<UserId>,
}

pub type Response = UnitResult;
