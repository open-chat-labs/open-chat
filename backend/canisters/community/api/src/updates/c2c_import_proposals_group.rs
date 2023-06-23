use serde::{Deserialize, Serialize};
use types::ChatId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: ChatId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    InternalError(String),
}
