use candid::Deserialize;
use oc_error_codes::OCError;
use serde::Serialize;
use types::UserId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Error(OCError),
}
