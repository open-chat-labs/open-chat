use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{GroupMember, TimestampMillis, UserId};

#[ts_export(group, lookup_members)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    // At most 1000
    pub user_ids: Vec<UserId>,
    // The latest timestamp of the details the caller holds (see `selected_initial`), so that a
    // replica which is behind that, and so could return members who have since left, returns
    // `ReplicaNotUpToDate` instead
    pub latest_known_update: Option<TimestampMillis>,
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
