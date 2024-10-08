use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{FieldTooLongResult, FieldTooShortResult, UserId};

#[ts_export(community, create_user_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub name: String,
    pub user_ids: Vec<UserId>,
}

#[ts_export(community, create_user_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    NameInvalid,
    NameTaken,
    NotAuthorized,
    CommunityFrozen,
    UserSuspended,
    UserLapsed,
}

#[ts_export(community, create_user_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub user_group_id: u32,
}
