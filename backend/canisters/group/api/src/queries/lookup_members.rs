use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{GroupMember, UserId};

#[ts_export(group, lookup_members)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_ids: Vec<UserId>,
}

#[ts_export(group, lookup_members)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(group, lookup_members)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    // Those of the users who are members
    pub members: Vec<GroupMember>,
}
