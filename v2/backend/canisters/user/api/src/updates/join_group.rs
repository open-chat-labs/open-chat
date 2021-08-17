use candid::CandidType;
use serde::Deserialize;
use types::GroupChatId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub group_chat_id: GroupChatId,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyInGroup,
    GroupNotFound,
    GroupNotPublic,
    Blocked,
    NotAuthorized,
    InternalError(String),
}
