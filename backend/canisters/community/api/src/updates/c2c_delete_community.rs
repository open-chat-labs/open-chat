use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::Empty;

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    CommunityFrozen,
    UserSuspended,
    InternalError(String),
    UserLapsed,
    Error(OCError),
}
