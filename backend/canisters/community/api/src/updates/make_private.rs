use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::Empty;

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    AlreadyPrivate,
    UserSuspended,
    CommunityFrozen,
    InternalError,
}
