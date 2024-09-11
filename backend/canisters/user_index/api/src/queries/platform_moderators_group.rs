use candid::CandidType;
use ts_export::ts_export;
use types::{ChatId, Empty};

pub type Args = Empty;

#[ts_export(user_index, platform_moderators_group)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(ChatId),
}
