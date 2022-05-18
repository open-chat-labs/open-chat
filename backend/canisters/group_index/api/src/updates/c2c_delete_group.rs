use candid::CandidType;
use serde::Deserialize;
use types::UserId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub deleted_by: UserId,
    pub group_name: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
}
