use crate::UserCanisterEvent;
use serde::{Deserialize, Serialize};
use types::IdempotentEnvelope;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<UserCanisterEvent>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Blocked,
}
