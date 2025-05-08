use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, Notification};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    #[serde(rename = "n")]
    pub notifications: Vec<IdempotentEnvelope<Notification>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Blocked,
    InternalError(String),
}
