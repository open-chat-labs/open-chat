use candid::{CandidType, Principal};
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::UserDetails;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id_or_principal: Principal,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(UserDetails),
    UserNotFound,
    Error(OCError),
}
