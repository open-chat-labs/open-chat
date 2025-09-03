use ic_principal::Principal;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::Empty;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Empty),
    Error(OCError),
}
