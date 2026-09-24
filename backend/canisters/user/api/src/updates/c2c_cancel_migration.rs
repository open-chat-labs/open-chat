use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::Empty;

pub type Args = Empty;

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Error(OCError),
}
