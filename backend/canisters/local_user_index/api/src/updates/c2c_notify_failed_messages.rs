use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub recipients: Vec<UserId>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
