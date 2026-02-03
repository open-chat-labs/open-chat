use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::SuccessOnly;

#[ts_export(user_index, set_hide_online_status)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub hide_online_status: bool,
}

pub type Response = SuccessOnly;
