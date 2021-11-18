use candid::{CandidType, Principal};
use serde::Deserialize;
use types::UserId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_principal: Principal,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(UserId),
    UserNotFound,
}
