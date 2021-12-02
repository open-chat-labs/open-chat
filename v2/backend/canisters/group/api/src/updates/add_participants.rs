use candid::CandidType;
use serde::Deserialize;
use types::UserId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_ids: Vec<UserId>,
    pub current_user_username: String,
    pub allow_blocked_users: bool,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    PartialSuccess(PartialSuccessResult),
    Failed(FailedResult),
    CallerNotInGroup,
    ParticipantLimitReached(u32),
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
