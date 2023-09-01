use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{FieldTooLongResult, FieldTooShortResult, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_group_id: u32,
    pub name: Option<String>,
    pub users_to_add: Vec<UserId>,
    pub users_to_remove: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserGroupNotFound,
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    NameTaken,
    NotAuthorized,
    CommunityFrozen,
    UserSuspended,
}
