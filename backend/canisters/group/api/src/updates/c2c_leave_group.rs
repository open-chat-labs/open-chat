use ic_principal::Principal;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{Empty, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
    // The user being acted for, which must be one of the calling MultiUser canister's users
    pub user_id: UserId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Empty),
    Error(OCError),
}
