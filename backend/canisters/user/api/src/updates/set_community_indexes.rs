use candid::CandidType;
use ts_export::ts_export;
use types::CommunityId;

#[ts_export(user, set_community_indexes)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub indexes: Vec<(CommunityId, u32)>,
}

#[ts_export(user, set_community_indexes)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
}
