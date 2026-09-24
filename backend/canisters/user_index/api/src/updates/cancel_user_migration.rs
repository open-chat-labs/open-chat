use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::UserId;

// Only available in test mode, until the UserIndex migrates users itself
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Error(OCError),
}
