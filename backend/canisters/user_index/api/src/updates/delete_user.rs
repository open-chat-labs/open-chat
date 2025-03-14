use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{SignedDelegation, UserId};

#[ts_export(user_index, delete_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub delegation: SignedDelegation,
}

#[ts_export(user_index, delete_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    MalformedSignature(String),
    DelegationTooOld,
    UserNotFound,
    Error(OCError),
}
