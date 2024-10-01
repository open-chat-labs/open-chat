use candid::CandidType;
use human_readable::HumanReadable;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(user_index, set_user_upgrade_concurrency)]
#[derive(CandidType, Serialize, Deserialize, HumanReadable, Clone, Debug)]
pub struct Args {
    pub value: u32,
}

#[ts_export(user_index, set_user_upgrade_concurrency)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
