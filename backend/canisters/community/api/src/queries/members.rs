use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityMember, UserId};

#[ts_export(community, members)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
    // The members are returned in order of user id, starting from the first after this. The owners
    // and admins are instead all returned with the first page, where this is not set.
    //
    // The pages aren't a snapshot: a member who joins, or is given or loses a role, part way
    // through them can be missed or returned twice. So the updates since the first page was
    // returned (by `selected_initial`) must also be applied, using `selected_updates_v2`.
    pub after: Option<UserId>,
    // Capped at 1000
    pub max_results: u32,
}

#[ts_export(community, members)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(community, members)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub members: Vec<CommunityMember>,
    pub basic_members: Vec<UserId>,
    // Set if there are more members, to the `after` to pass to get the next page of them
    pub more_members_after: Option<UserId>,
}
