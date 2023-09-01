use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{FieldTooLongResult, FieldTooShortResult, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub name: String,
    pub user_ids: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    NameTaken,
    NotAuthorized,
    CommunityFrozen,
    UserSuspended,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub user_group_id: u32,
}
