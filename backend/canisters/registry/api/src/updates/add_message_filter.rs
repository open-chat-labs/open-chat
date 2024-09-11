use candid::CandidType;
use ts_export::ts_export;

#[ts_export(registry, add_message_filter)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub regex: String,
}

#[ts_export(registry, add_message_filter)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(u64),
    NotAuthorized,
    AlreadyAdded,
    InvalidRequest(String),
    InternalError(String),
}
