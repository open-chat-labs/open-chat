use candid::CandidType;
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(storage_index, user)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(UserRecord),
    UserNotFound,
}

#[ts_export(storage_index, user)]
#[derive(CandidType, Debug)]
pub struct UserRecord {
    pub byte_limit: u64,
    pub bytes_used: u64,
}
