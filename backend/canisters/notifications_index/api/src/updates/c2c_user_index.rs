use crate::UserIndexEvent;
use serde::{Deserialize, Serialize};
use types::IdempotentEnvelope;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<UserIndexEvent>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum Response {
    Success,
}
