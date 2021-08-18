use candid::CandidType;
use serde::Deserialize;
use types::UserId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_ids: Vec<UserId>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    PartialSuccess(PartialSuccessResult),
    Failed(FailedResult),
    NotInGroup,
    NotAuthorized,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct PartialSuccessResult {
    pub users_added: Vec<UserId>,
    pub users_already_in_group: Vec<UserId>,
    pub users_blocked_from_group: Vec<UserId>,
    pub users_who_blocked_request: Vec<UserId>,
    pub errors: Vec<UserId>,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct FailedResult {
    pub users_already_in_group: Vec<UserId>,
    pub users_blocked_from_group: Vec<UserId>,
    pub users_who_blocked_request: Vec<UserId>,
    pub errors: Vec<UserId>,
}
