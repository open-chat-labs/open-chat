use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(user_index, set_moderation_flags)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub moderation_flags_enabled: u32,
}

#[ts_export(user_index, set_moderation_flags)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
