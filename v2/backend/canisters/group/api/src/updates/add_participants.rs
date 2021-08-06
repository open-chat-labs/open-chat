use candid::CandidType;
use serde::Deserialize;
use shared::types::UserId;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub user_ids: Vec<UserId>,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
    PartialSuccess(PartialSuccessResult),
    Failed(FailedResult),
    NotInGroup,
    NotAuthorized,
}

#[derive(CandidType, Deserialize)]
pub struct PartialSuccessResult {
    pub users_added: Vec<UserId>,
    pub users_already_in_group: Vec<UserId>,
    pub users_blocked_from_group: Vec<UserId>,
    pub users_who_blocked_request: Vec<UserId>,
    pub errors: Vec<UserId>,
}

#[derive(CandidType, Deserialize)]
pub struct FailedResult {
    pub users_already_in_group: Vec<UserId>,
    pub users_blocked_from_group: Vec<UserId>,
    pub users_who_blocked_request: Vec<UserId>,
    pub errors: Vec<UserId>,
}
