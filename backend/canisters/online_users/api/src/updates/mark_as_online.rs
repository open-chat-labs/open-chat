use candid::CandidType;
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(online_users, mark_as_online)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    UserNotFound,
    InternalError(String),
}
