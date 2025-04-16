use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(community, delete_user_groups)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_group_ids: Vec<u32>,
}

pub type Response = UnitResult;
