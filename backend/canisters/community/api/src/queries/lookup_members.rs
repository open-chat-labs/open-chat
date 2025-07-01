use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityMember, UserId};

#[ts_export(community, community_members)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_ids: Vec<UserId>,
}

#[ts_export(community, community_members)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(community, community_members)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub members: Vec<CommunityMember>,
}
