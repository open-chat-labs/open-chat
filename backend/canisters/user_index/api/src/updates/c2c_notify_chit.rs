use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::NotifyChit;

pub type Args = NotifyChit;

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserNotFound,
    Error(OCError),
}
