use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, set_moderation_flags)]
pub struct Args {
    pub moderation_flags_enabled: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, set_moderation_flags)]
pub enum Response {
    Success,
}
