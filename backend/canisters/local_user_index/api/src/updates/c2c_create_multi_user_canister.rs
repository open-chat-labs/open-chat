use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CanisterId),
    Error(OCError),
}
