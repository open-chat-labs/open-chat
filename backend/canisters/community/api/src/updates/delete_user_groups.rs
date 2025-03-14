use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(community, delete_user_groups)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_group_ids: Vec<u32>,
}

#[ts_export(community, delete_user_groups)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    CommunityFrozen,
    UserSuspended,
    UserLapsed,
    Error(OCError),
}
