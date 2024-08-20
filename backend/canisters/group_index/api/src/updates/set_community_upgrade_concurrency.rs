use candid::CandidType;
use ts_export::ts_export;

#[ts_export(group_index, set_community_upgrade_concurrency)]
#[derive(CandidType, Clone, Debug)]
pub struct Args {
    pub value: u32,
}

#[ts_export(group_index, set_community_upgrade_concurrency)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    InternalError(String),
}
