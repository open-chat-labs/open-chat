use serde::{Deserialize, Serialize};
use types::{CanisterId, IdempotentEnvelope, Notification};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    #[serde(rename = "n")]
    pub notifications: Vec<IdempotentEnvelope<Notification>>,
    #[serde(rename = "a")]
    pub authorizer: Option<CanisterId>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Blocked,
    InternalError(String),
}
