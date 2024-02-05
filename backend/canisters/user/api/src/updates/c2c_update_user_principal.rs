use candid::Principal;
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub new_principal: Principal,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub canisters_to_notify: Vec<CanisterId>,
}
