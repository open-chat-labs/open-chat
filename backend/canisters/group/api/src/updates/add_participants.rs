use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_ids: Vec<UserId>,
    pub added_by_name: String,
    pub allow_blocked_users: bool,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    PartialSuccess(PartialSuccessResult),
    Failed(FailedResult),
    CallerNotInGroup,
    ParticipantLimitReached(u32),
    NotAuthorized,
    UserSuspended,
    ChatFrozen,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PartialSuccessResult {
    pub users_added: Vec<UserId>,
    pub users_already_in_group: Vec<UserId>,
    pub users_blocked_from_group: Vec<UserId>,
    pub users_who_blocked_request: Vec<UserId>,
    pub users_not_authorized_to_add: Vec<UserId>,
    pub users_who_failed_gate_check: Vec<UserId>,
    pub users_suspended: Vec<UserId>,
    pub errors: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct FailedResult {
    pub users_already_in_group: Vec<UserId>,
    pub users_blocked_from_group: Vec<UserId>,
    pub users_who_blocked_request: Vec<UserId>,
    pub users_not_authorized_to_add: Vec<UserId>,
    pub users_who_failed_gate_check: Vec<UserId>,
    pub users_suspended: Vec<UserId>,
    pub errors: Vec<UserId>,
}
