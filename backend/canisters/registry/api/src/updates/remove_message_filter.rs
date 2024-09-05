use candid::CandidType;
use ts_export::ts_export;

#[ts_export(registry, remove_message_filter)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub id: u64,
}

#[ts_export(registry, remove_message_filter)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    NotFound,
    InternalError(String),
}
