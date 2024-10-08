use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{FieldTooLongResult, FieldTooShortResult, UserId};

#[ts_export(community, update_user_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_group_id: u32,
    pub name: Option<String>,
    pub users_to_add: Vec<UserId>,
    pub users_to_remove: Vec<UserId>,
}

#[ts_export(community, update_user_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserGroupNotFound,
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    NameInvalid,
    NameTaken,
    NotAuthorized,
    CommunityFrozen,
    UserSuspended,
    UserLapsed,
}
