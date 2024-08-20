use candid::CandidType;
use ts_export::ts_export;
use types::CanisterId;

#[ts_export(group_index, mark_local_group_index_full)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub canister_id: CanisterId,
    pub full: bool,
}

#[ts_export(group_index, mark_local_group_index_full)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    LocalGroupIndexNotFound,
    NotAuthorized,
    InternalError(String),
}
