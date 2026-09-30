use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{GroupMember, UserId};

#[ts_export(group, members)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    // The members are returned in order of user id, starting from the first after this. The owners,
    // admins and moderators are instead all returned with the first page, where this is not set.
    pub after: Option<UserId>,
    pub max_results: u32,
}

#[ts_export(group, members)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(group, members)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub members: Vec<GroupMember>,
    pub basic_members: Vec<UserId>,
    // Set if there are more members, to the `after` to pass to get the next page of them
    pub more_members_after: Option<UserId>,
}
