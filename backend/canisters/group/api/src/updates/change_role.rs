use candid::CandidType;
use serde::Deserialize;
use types::{Role, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub new_role: Role,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotInGroup,
    NotAuthorized,
    UserNotInGroup,
    Invalid,
}
