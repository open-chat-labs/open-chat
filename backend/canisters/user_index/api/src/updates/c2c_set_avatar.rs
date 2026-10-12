use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub avatar_id: Option<u128>,
    // The user whose avatar this is, which must be one of the calling MultiUser canister's users
    pub user_id: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserNotFound,
    Error(OCError),
}
