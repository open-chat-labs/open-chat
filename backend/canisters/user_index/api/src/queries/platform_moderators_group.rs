use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{ChatId, Empty};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, platform_moderators_group)]
pub enum Response {
    Success(ChatId),
}
