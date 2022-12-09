use candid::Principal;
use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
    pub username: String,
    pub referred_by: Option<UserId>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(UserId),
    AlreadyRegistered,
    CyclesBalanceTooLow,
    InternalError(String),
}
