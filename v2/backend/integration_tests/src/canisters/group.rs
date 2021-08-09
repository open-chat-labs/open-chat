use crate::types::UserId;
use crate::utils::delay;
use candid::{CandidType, Decode, Encode, Principal};
use ic_agent::Agent;
use serde::Deserialize;

generate_update_call!(add_participants);

pub mod add_participants {
    use super::*;

    #[derive(CandidType, Deserialize, Clone, Debug)]
    pub struct Args {
        pub user_ids: Vec<UserId>,
    }

    #[derive(CandidType, Deserialize, Clone, Debug)]
    pub enum Response {
        Success,
        PartialSuccess(PartialSuccessResult),
        Failed(FailedResult),
        NotInGroup,
        NotAuthorized,
    }

    #[derive(CandidType, Deserialize, Clone, Debug)]
    pub struct PartialSuccessResult {
        pub users_added: Vec<UserId>,
        pub users_already_in_group: Vec<UserId>,
        pub users_blocked_from_group: Vec<UserId>,
        pub users_who_blocked_request: Vec<UserId>,
        pub errors: Vec<UserId>,
    }

    #[derive(CandidType, Deserialize, Clone, Debug)]
    pub struct FailedResult {
        pub users_already_in_group: Vec<UserId>,
        pub users_blocked_from_group: Vec<UserId>,
        pub users_who_blocked_request: Vec<UserId>,
        pub errors: Vec<UserId>,
    }
}
