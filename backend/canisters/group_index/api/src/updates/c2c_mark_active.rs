use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{Milliseconds, PublicGroupActivity};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub duration: Milliseconds,
    pub public_group_activity: Option<PublicGroupActivity>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
    Error(OCError),
}
