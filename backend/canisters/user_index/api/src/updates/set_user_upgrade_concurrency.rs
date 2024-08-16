use candid::CandidType;
use human_readable::HumanReadable;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;

#[derive(CandidType, Serialize, Deserialize, HumanReadable, Clone, Debug)]
#[ts_export(user_index, set_user_upgrade_concurrency)]
pub struct Args {
    pub value: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, set_user_upgrade_concurrency)]
pub enum Response {
    Success,
}
