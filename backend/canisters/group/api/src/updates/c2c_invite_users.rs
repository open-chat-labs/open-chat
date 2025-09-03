use ic_principal::Principal;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub caller: UserId,
    pub users: Vec<(UserId, Principal)>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub invited_users: Vec<UserId>,
    pub group_name: String,
}
