use candid::CandidType;
use serde::Deserialize;
use types::UserId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub new_owner: UserId,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotInGroup,
    NotAuthorized,
    UserNotInGroup,
}
