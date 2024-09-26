use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(group, disable_invite_code)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub correlation_id: u64,
}

#[ts_export(group, disable_invite_code)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    UserSuspended,
    ChatFrozen,
}
